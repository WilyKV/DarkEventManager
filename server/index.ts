// Charge les variables d'environnement d'un fichier .env s'il existe.
// DOIT rester en premier, avant tout module lisant process.env (ex: ./db).
// dotenv n'écrase pas les variables déjà définies (Docker Compose, shell…).
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { registerSyncRoutes } from "./sync-routes";
import { registerSyncPushPullRoutes } from "./sync-push-pull-routes";
import { registerAuthRoutes } from "./auth-routes";
import { setupEndEventRoute } from "./end-event-routes";
import { wsSyncServer } from "./websocket-sync";
import { checkSyncPermissions } from "./sync-middleware";
import { serveStatic, log } from "./static";
import { validateWebSocketSecret } from "./websocket-secret-config";
import { validateSessionSecret } from "./session-secret-config";
import { createSessionStore } from "./session-config";
import { sessionLogger } from "./session-logger";
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
app.use("/api/events/bulk-ingest", express.json({ limit: BULK_INGEST_BODY_LIMIT }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  // Debug session
  if (path.startsWith("/api/auth")) {
    sessionLogger(req, `SessionID=${req.sessionID || 'NONE'}`, { level: "info" });
  }

  next();
});

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
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
