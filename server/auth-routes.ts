import type { Express, Request } from "express";
import { sessionLogger } from "./session-logger";
import { db } from "./db";
import { users } from "@shared/schema";
import { loginSchema, visitorLoginSchema, insertUserSchema, newStaffPasswordSchema, type InsertUser } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import crypto from "crypto";
import { participants } from "@shared/schema";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { storage } from "./storage";
import { accountRevision } from "./session-account";
import { hashPassword, verifyPassword, isLegacyHash } from "./password-hashing";
import { requireAuth, requireRole } from "./auth-middleware";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_VISITOR_MAX, RATE_LIMIT_STAFF_MAX } from "./config/limits";

export { requireAuth, requireRole };

const setupSchema = z.object({
  username: z.string().trim().min(3).max(128).default("admin"),
  password: newStaffPasswordSchema,
  setupToken: z.string().max(512).optional(),
});

function clientNetwork(req: Request) {
  const ip = req.ip ?? req.socket.remoteAddress;
  return ip ? ipKeyGenerator(ip) : "unknown";
}

export function registerAuthRoutes(app: Express) {
  const options = {
    windowMs: RATE_LIMIT_WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Trop de tentatives, réessayez plus tard." },
  };
  const visitorLoginLimiter = rateLimit({ ...options, limit: RATE_LIMIT_VISITOR_MAX, skipSuccessfulRequests: true });
  const staffIpLimiter = rateLimit({ ...options, limit: 25, skipSuccessfulRequests: true });
  const staffLoginLimiter = rateLimit({
    ...options,
    limit: RATE_LIMIT_STAFF_MAX,
    skipSuccessfulRequests: true,
    keyGenerator: req => {
      const username = typeof req.body?.username === "string" ? req.body.username.slice(0, 128).toLowerCase() : "";
      return `${clientNetwork(req)}:${username}`;
    },
  });
  const setupLimiter = rateLimit({ ...options, limit: RATE_LIMIT_STAFF_MAX });

  // Login with username/password
  app.post("/api/auth/login", staffIpLimiter, staffLoginLimiter, async (req, res) => {
    try {
      const body = loginSchema.parse(req.body);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);

      const passwordOk = user ? await verifyPassword(body.password, user.passwordHash) : false;

      if (!user || !passwordOk) {
        storage.createAuditLog({
          action: 'LOGIN_FAILED',
          tableName: 'users',
          recordId: null,
          username: body.username,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
        }).catch(() => {});
        return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
      }

      // Lazy migration: upgrade legacy SHA-256 hash to bcrypt
      let currentHash = user.passwordHash;
      if (isLegacyHash(user.passwordHash)) {
        currentHash = await hashPassword(body.password);
        await db
          .update(users)
          .set({ passwordHash: currentHash })
          .where(eq(users.id, user.id));
        sessionLogger(req, `Migrated password hash for user ${user.username} from SHA-256 to bcrypt`);
      }

      // Update last login
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      // Check if session exists
      if (!req.session) {
        return res.status(500).json({ message: "Session non disponible" });
      }

      // Regenerate session to ensure it's properly initialized
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Store user in session — parse JSON-encoded roles string to string[]
      let parsedRoles: string[] = [];
      try { parsedRoles = JSON.parse(user.roles || "[]"); } catch { parsedRoles = []; }
      req.session.user = {
        id: user.id,
        username: user.username,
        roles: parsedRoles,
      };
      req.session.staffRevision = accountRevision({ passwordHash: currentHash, roles: user.roles });

      // Explicitly save the session
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      storage.createAuditLog({
        action: 'LOGIN_SUCCESS',
        tableName: 'users',
        recordId: user.id,
        username: user.username,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      }).catch(() => {});

      res.json({
        user: {
          id: user.id,
          username: user.username,
          roles: parsedRoles,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Données invalides", errors: error.issues });
      } else {
        sessionLogger(req, `Login error: ${error}`, { level: "error" });
        res.status(500).json({ message: "Erreur lors de la connexion" });
      }
    }
  });

  // Login with secret code (visitor access)
  app.post("/api/auth/login-visitor", visitorLoginLimiter, async (req, res) => {
    try {
      const body = visitorLoginSchema.parse(req.body);

      const [participant] = await db
        .select()
        .from(participants)
        .where(and(eq(participants.secretCode, body.secretCode), isNull(participants.deletedAt)))
        .limit(1);

      if (!participant) {
        storage.createAuditLog({
          action: 'LOGIN_FAILED',
          tableName: 'participants',
          recordId: null,
          username: null,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
        }).catch(() => {});
        return res.status(401).json({ message: "Code ou informations incorrects" });
      }

      // Verify first letter of last name
      const firstLetterLastName = participant.lastName.charAt(0).toUpperCase();
      const providedLetter = body.firstLetterLastName.toUpperCase();

      if (firstLetterLastName !== providedLetter) {
        storage.createAuditLog({
          action: 'LOGIN_FAILED',
          tableName: 'participants',
          recordId: null,
          username: null,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
        }).catch(() => {});
        return res.status(401).json({ message: "Code ou informations incorrects" });
      }

      // Regenerate session
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Store visitor session
      req.session.visitor = {
        participantId: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        secretCode: participant.secretCode!,
      };

      // Explicitly save the session
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      storage.createAuditLog({
        action: 'LOGIN_SUCCESS',
        tableName: 'participants',
        recordId: participant.id,
        username: null,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      }).catch(() => {});

      res.json({
        participant: {
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          type: participant.type,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Données invalides", errors: error.issues });
      } else {
        sessionLogger(req, `Visitor login error: ${error}`, { level: "error" });
        res.status(500).json({ message: "Erreur lors de la connexion" });
      }
    }
  });

  // Get current session
  app.get("/api/auth/session", (req, res) => {
    if (req.session?.user) {
      res.json({
        user: req.session.user,
      });
    } else if (req.session?.visitor) {
      res.json({
        visitor: req.session.visitor,
      });
    } else {
      res.status(401).json({ message: "Non authentifié" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        sessionLogger(req, `Logout error: ${err}`, { level: "error" });
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.json({ message: "Déconnecté avec succès" });
    });
  });

  // Create user (admin only)
  app.post("/api/auth/users", requireRole('admin'), async (req, res) => {
    try {
      const body = insertUserSchema.parse(req.body) as InsertUser;
      const passwordHash = await hashPassword(body.passwordHash); // passwordHash is the password from client

      // Check if username already exists
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);

      if (existing) {
        return res.status(400).json({ message: "Ce nom d'utilisateur est déjà utilisé" });
      }

      // Parse roles if it's a string, or use it as is if it's already valid
      let rolesValue: string | string[] = body.roles ?? '[]';
      if (typeof body.roles === 'string') {
        try {
          rolesValue = JSON.parse(body.roles);
        } catch {
          rolesValue = [body.roles]; // If it's a simple string, wrap it in an array
        }
      }

      const [newUser] = await db
        .insert(users)
        .values({
          username: body.username,
          passwordHash,
          roles: JSON.stringify(Array.isArray(rolesValue) ? rolesValue : [rolesValue]),
        })
        .returning();

      res.json({
        id: newUser.id,
        username: newUser.username,
        roles: newUser.roles,
        createdAt: newUser.createdAt,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Données invalides", errors: error.issues });
      } else {
        sessionLogger(req, `Create user error: ${error}`, { level: "error" });
        res.status(500).json({ message: "Erreur lors de la création de l'utilisateur" });
      }
    }
  });

  // Update user password (admin only)
  app.patch("/api/auth/users/:id/password", requireRole('admin'), async (req, res) => {
    try {
      const userId = parseInt(String(req.params.id), 10);
      const { password } = req.body;

      const parsed = newStaffPasswordSchema.safeParse(password);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

      const passwordHash = await hashPassword(parsed.data);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, userId));

      res.json({ message: "Mot de passe mis à jour avec succès" });
    } catch (error) {
      sessionLogger(req, `Update password error: ${error}`, { level: "error" });
      res.status(500).json({ message: "Erreur lors de la mise à jour du mot de passe" });
    }
  });

  // Update user roles (admin only)
  app.patch("/api/auth/users/:id/roles", requireRole('admin'), async (req, res) => {
    try {
      const userId = parseInt(String(req.params.id), 10);
      const { roles } = req.body;

      if (!Array.isArray(roles)) {
        return res.status(400).json({ message: "Les rôles doivent être un tableau" });
      }

      await db
        .update(users)
        .set({ roles: JSON.stringify(roles) })
        .where(eq(users.id, userId));

      res.json({ message: "Rôles mis à jour avec succès" });
    } catch (error) {
      sessionLogger(req, `Update roles error: ${error}`, { level: "error" });
      res.status(500).json({ message: "Erreur lors de la mise à jour des rôles" });
    }
  });

  // Get all users (admin only)
  app.get("/api/auth/users", requireRole('admin'), async (req, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          roles: users.roles,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users);

      res.json(allUsers);
    } catch (error) {
      sessionLogger(req, `Get users error: ${error}`, { level: "error" });
      res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/auth/users/:id", requireRole('admin'), async (req, res) => {
    try {
      const userId = parseInt(String(req.params.id), 10);

      // Prevent admin from deleting themselves
      if (req.session?.user?.id === userId) {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
      }

      await db.delete(users).where(eq(users.id, userId));

      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      sessionLogger(req, `Delete user error: ${error}`, { level: "error" });
      res.status(500).json({ message: "Erreur lors de la suppression de l'utilisateur" });
    }
  });

  // Setup status: public endpoint to check if first-time setup is needed
  app.get("/api/setup/status", async (_req, res) => {
    try {
      const existingUsers = await db.select().from(users).limit(1);
      res.json({ needsSetup: existingUsers.length === 0 });
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la vérification du statut" });
    }
  });

  app.post("/api/auth/init", setupLimiter, async (req, res) => {
    try {
      const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
      if (existingUsers.length) {
        return res.status(403).json({ code: "setup_complete", message: "Initialisation déjà effectuée" });
      }

      const configuredToken = process.env.SETUP_TOKEN;
      if (process.env.NODE_ENV === "production" || configuredToken) {
        if (!configuredToken || configuredToken.length < 32) {
          return res.status(503).json({ message: "Renseignez SETUP_TOKEN dans les variables de démarrage pour initialiser l’application." });
        }
        const supplied = typeof req.body?.setupToken === "string" && req.body.setupToken.length <= 512 ? req.body.setupToken : "";
        const digest = (token: string) => crypto.createHash("sha256").update(token).digest();
        if (!crypto.timingSafeEqual(digest(supplied), digest(configuredToken))) {
          return res.status(403).json({ message: "Code d’installation incorrect." });
        }
      }

      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
      const { username, password } = parsed.data;
      const passwordHash = await hashPassword(password);
      const created = await db.transaction(async tx => {
        await tx.execute(sql`LOCK TABLE ${users} IN SHARE ROW EXCLUSIVE MODE`);
        const accounts = await tx.select({ id: users.id }).from(users).limit(1);
        if (accounts.length) return false;
        await tx.insert(users).values({ username, passwordHash, roles: JSON.stringify(["admin"]) });
        return true;
      });

      if (!created) {
        return res.status(403).json({ code: "setup_complete", message: "Initialisation déjà effectuée" });
      }
      res.status(201).json({ message: "Administrateur créé", username });
    } catch (error) {
      sessionLogger(req, `Init admin error: ${error}`, { level: "error" });
      res.status(500).json({ message: "Erreur lors de l’initialisation" });
    }
  });
}
