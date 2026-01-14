import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { registerSyncRoutes } from "./sync-routes";
import { registerSyncPushPullRoutes } from "./sync-push-pull-routes";
import { registerAuthRoutes } from "./auth-routes";
import { setupEndEventRoute } from "./end-event-routes";
import { wsSyncServer } from "./websocket-sync";
import { checkSyncPermissions } from "./sync-middleware";
import { setupVite, serveStatic, log } from "./vite";
import { logger, logRequest } from "./utils/logger";

const PgSession = connectPgSimple(session);

const app = express();

// Security: Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now (Vite needs it)
  crossOriginEmbedderPolicy: false, // Needed for some resources
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting for authentication endpoints (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
});

// Rate limiting for general API endpoints (relaxed)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: { message: 'Trop de requêtes, veuillez ralentir' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful responses (optional)
  skip: (req) => req.path.startsWith('/api/dashboard/stats'), // Dashboard needs frequent updates
});

// Validate SESSION_SECRET
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    '🚨 CRITICAL: SESSION_SECRET must be set in environment variables and be at least 32 characters.\n' +
    'Generate one with:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}

// Validate DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('🚨 CRITICAL: DATABASE_URL must be set in environment variables');
}

// Session configuration with PostgreSQL store
app.use(session({
  name: 'darkevent.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new PgSession({
    conString: DATABASE_URL,
    tableName: 'session', // Table name for sessions
    createTableIfMissing: true, // Auto-create table if it doesn't exist
    ttl: 24 * 60 * 60, // 24 hours in seconds
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
  }),
  cookie: {
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production
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

      // Structured logging for API requests
      logRequest(req.method, path, res.statusCode, duration, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.session?.user?.id,
      });
    }
  });

  // Debug session
  if (path.startsWith("/api/auth")) {
    logger.debug('Auth request session debug', {
      method: req.method,
      path: path,
      sessionId: req.sessionID || 'NONE',
      sessionUser: req.session?.user ? req.session.user : 'NONE',
      hasCookie: !!req.headers.cookie,
    });
  }

  next();
});

(async () => {
  // Apply rate limiting to authentication routes
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/login-visitor', authLimiter);

  // Apply general rate limiting to all API routes (except specific ones)
  app.use('/api/', apiLimiter);

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

    // Log error with structured logging
    logger.error('Request error', {
      error: message,
      status: status,
      stack: err.stack,
      path: _req.path,
      method: _req.method,
    });

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

    // Structured logging for server startup
    logger.info('Server started successfully', {
      port: port,
      host: '0.0.0.0',
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    });

    // Start WebSocket Sync Server
    wsSyncServer.start(server);
    logger.info('WebSocket sync server started');
  });
})();
