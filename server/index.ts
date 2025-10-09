import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { registerSyncRoutes } from "./sync-routes";
import { registerSyncPushPullRoutes } from "./sync-push-pull-routes";
import { registerAuthRoutes } from "./auth-routes";
import { setupEndEventRoute } from "./end-event-routes";
import { wsSyncServer } from "./websocket-sync";
import { checkSyncPermissions } from "./sync-middleware";
import { setupVite, serveStatic, log } from "./vite";

const SessionStore = MemoryStore(session);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(session({
  name: 'darkevent.sid',
  secret: process.env.SESSION_SECRET || 'darkevent-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: new SessionStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
  cookie: {
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
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
    console.log(`[Session Debug] ${req.method} ${path}`);
    console.log(`  SessionID: ${req.sessionID || 'NONE'}`);
    console.log(`  Session user: ${req.session?.user ? JSON.stringify(req.session.user) : 'NONE'}`);
    console.log(`  Cookies: ${req.headers.cookie || 'NONE'}`);
  }

  next();
});

(async () => {
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
