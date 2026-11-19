// Charge les variables d'environnement d'un fichier .env s'il existe.
// DOIT rester en premier, avant tout module lisant process.env (ex: ./db).
// dotenv n'écrase pas les variables déjà définies (Docker Compose, shell…).
import "dotenv/config";
import { publishLiveChanges } from "./live-updates";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { registerCheckInRoutes } from "./check-in-routes";
import { registerDemoDataRoutes } from "./demo-data-routes";
import { registerZombieOfflineRoutes } from "./zombie-offline-routes";
import { registerSyncRoutes } from "./sync-routes";
import { registerSyncPushPullRoutes } from "./sync-push-pull-routes";
import { registerAuthRoutes } from "./auth-routes";
import { requireAuth } from "./auth-middleware";
import { setupEndEventRoute } from "./end-event-routes";
import { wsSyncServer } from "./websocket-sync";
import { validateSessionAccount } from "./session-account";
import { protectApiOrigin } from "./request-origin";
import { serveStatic, log } from "./static";
import { validateWebSocketSecret } from "./websocket-secret-config";
import { validateSessionSecret } from "./session-secret-config";
import { createSessionStore } from "./session-config";
import { pool } from "./db";
import { getSessionCookieOptions } from "./session-cookie-config";
import { applySecurityHeaders } from "./security-headers";
import { configureProxyTrust } from "./proxy-trust-config";
import { childLogger } from "./logger";
import { BULK_INGEST_BODY_LIMIT } from "./config/limits";

const appLogger = childLogger('app');

// Validation du SESSION_SECRET au démarrage (avant toute initialisation)
const sessionSecretCheck = validateSessionSecret(process.env as Record<string, string | undefined>);
if (sessionSecretCheck.mode === 'fail') {
  appLogger.fatal({ module: 'session' }, sessionSecretCheck.message);
  process.exit(1);
} else if (sessionSecretCheck.mode === 'warn') {
  appLogger.warn({ module: 'session' }, sessionSecretCheck.message);
}

const app = express();

// En production, l'app est derrière nginx qui termine TLS et proxifie en HTTP.
// Sans trust proxy, Express voit req.secure === false et n'émet pas le Set-Cookie
// quand cookie.secure === true. On fait confiance au 1er hop (nginx).
configureProxyTrust(app, process.env);

applySecurityHeaders(app);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
}, protectApiOrigin);
// Session configuration
app.use(session({
  name: 'darkevent.sid',
  secret: sessionSecretCheck.secret,
  resave: false,
  saveUninitialized: false,
  store: createSessionStore(process.env, pool),
  cookie: {
    path: '/',
    ...getSessionCookieOptions(process.env),
  },
}));
app.use("/api", validateSessionAccount);
app.use("/api/events/bulk-ingest", requireAuth, express.json({ limit: BULK_INGEST_BODY_LIMIT }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  if (/^\/api(?:\/|$)/i.test(path)) {
    res.once("finish", () => {
      log(`${req.method} ${path.slice(0, 100)} ${res.statusCode} in ${Date.now() - start}ms`);
    });
  }

  next();
});

app.use(publishLiveChanges);

(async () => {
  // Validate WebSocket secret configuration at startup
  const wsSecretCheck = validateWebSocketSecret(process.env as Record<string, string | undefined>);
  if (wsSecretCheck.mode === 'fail') {
    throw new Error(wsSecretCheck.message);
  } else if (wsSecretCheck.mode === 'warn') {
    appLogger.warn({ module: 'websocket' }, wsSecretCheck.message);
  }

  // Register auth routes FIRST (no middleware needed)
  registerAuthRoutes(app);

  // Register sync routes (these have their own permission logic)
  registerSyncRoutes(app);
  registerSyncPushPullRoutes(app);

  // Register end event route (admin only)
  setupEndEventRoute(app);

  // Register main routes
  registerDemoDataRoutes(app);
  registerZombieOfflineRoutes(app);
  registerCheckInRoutes(app);
  const server = await registerRoutes(app);

  app.use("/api", (_req, res) => res.status(404).json({ message: "Route API introuvable" }));
  app.use((err: { status?: number; statusCode?: number; code?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : (err.status ?? err.statusCode);
    if (status === 413) return res.status(413).json({ message: "Fichier ou requête trop volumineuse" });
    if (typeof status === "number" && status >= 400 && status < 500) {
      return res.status(status).json({ message: "Requête invalide" });
    }
    if (err.code?.startsWith("LIMIT_")) return res.status(400).json({ message: "Envoi de fichier invalide" });
    appLogger.error({ type: err instanceof Error ? err.name : "UnknownError" }, "Erreur de traitement HTTP");
    return res.status(500).json({ message: "Erreur interne du serveur" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development" && process.env.SERVE_BUILT_CLIENT !== "true") {
    // Import dynamique : vite n'est chargé qu'en dev, pas dans le bundle de prod
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Start WebSocket Sync Server
    wsSyncServer.start(server);
  });
})();
