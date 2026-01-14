import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { loginSchema, visitorLoginSchema, insertUserSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { participants } from "@shared/schema";

// Hash password with bcrypt (secure, slow hashing for passwords)
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Higher = more secure but slower
  return await bcrypt.hash(password, saltRounds);
}

// Verify password against hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Middleware to check if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  next();
}

// Middleware to check if user has required role
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    // Check if user has at least one of the required roles
    const userRoles = req.session.user.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ message: "Accès refusé - Permissions insuffisantes" });
    }

    next();
  };
}

export function registerAuthRoutes(app: Express) {

  // Login with username/password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const body = loginSchema.parse(req.body);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
      }

      // Verify password with bcrypt
      const isValidPassword = await verifyPassword(body.password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
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

      // Store user in session
      req.session.user = {
        id: user.id,
        username: user.username,
        roles: user.roles,
      };

      // Explicitly save the session
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          roles: user.roles,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Données invalides", errors: error.errors });
      } else {
        console.error("Login error:", error);
        res.status(500).json({ message: "Erreur lors de la connexion" });
      }
    }
  });

  // Login with secret code (visitor access)
  app.post("/api/auth/login-visitor", async (req, res) => {
    try {
      const body = visitorLoginSchema.parse(req.body);

      const [participant] = await db
        .select()
        .from(participants)
        .where(eq(participants.secretCode, body.secretCode))
        .limit(1);

      if (!participant) {
        return res.status(401).json({ message: "Code invalide" });
      }

      // Verify first letter of last name
      const firstLetterLastName = participant.lastName.charAt(0).toUpperCase();
      const providedLetter = body.firstLetterLastName.toUpperCase();

      if (firstLetterLastName !== providedLetter) {
        return res.status(401).json({ message: "Code ou première lettre du nom incorrecte" });
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
        res.status(400).json({ message: "Données invalides", errors: error.errors });
      } else {
        console.error("Visitor login error:", error);
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
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.json({ message: "Déconnecté avec succès" });
    });
  });

  // Create user (admin only)
  app.post("/api/auth/users", requireRole('admin'), async (req, res) => {
    try {
      const body = insertUserSchema.parse(req.body);
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
      let rolesValue = body.roles;
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
        res.status(400).json({ message: "Données invalides", errors: error.errors });
      } else {
        console.error("Create user error:", error);
        res.status(500).json({ message: "Erreur lors de la création de l'utilisateur" });
      }
    }
  });

  // Update user password (admin only)
  app.patch("/api/auth/users/:id/password", requireRole('admin'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
      }

      const passwordHash = await hashPassword(password);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, userId));

      res.json({ message: "Mot de passe mis à jour avec succès" });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du mot de passe" });
    }
  });

  // Update user roles (admin only)
  app.patch("/api/auth/users/:id/roles", requireRole('admin'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
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
      console.error("Update roles error:", error);
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
      console.error("Get users error:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/auth/users/:id", requireRole('admin'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Prevent admin from deleting themselves
      if (req.session?.user?.id === userId) {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
      }

      await db.delete(users).where(eq(users.id, userId));

      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Erreur lors de la suppression de l'utilisateur" });
    }
  });

  // Initialize admin user if no users exist
  app.post("/api/auth/init", async (req, res) => {
    try {
      const existingUsers = await db.select().from(users).limit(1);

      if (existingUsers.length > 0) {
        return res.status(400).json({ message: "Un administrateur existe déjà" });
      }

      const adminPassword = await hashPassword("admin123"); // Default password

      const [admin] = await db
        .insert(users)
        .values({
          username: "admin",
          passwordHash: adminPassword,
          role: "admin",
        })
        .returning();

      res.json({
        message: "Compte administrateur créé avec succès",
        username: "admin",
        defaultPassword: "admin123",
      });
    } catch (error) {
      console.error("Init admin error:", error);
      res.status(500).json({ message: "Erreur lors de l'initialisation" });
    }
  });
}
