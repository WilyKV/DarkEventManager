import type { IncomingMessage } from 'node:http';
import helmet from 'helmet';
import type { Express } from 'express';

export function applySecurityHeaders(app: Express): void {
  app.disable('x-powered-by');
  const isProduction = process.env['NODE_ENV'] === 'production';
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        // The welcome player reads cached audio and video through local Blob URLs.
        mediaSrc: ["'self'", "blob:"],
        // Explicitly allow the same-host WebSocket in browsers that do not include it in 'self'.
        connectSrc: ["'self'", (req: IncomingMessage) => {
          const host = req.headers.host;
          return host && /^(?:[a-z0-9.-]+|\[[a-f0-9:.]+\])(?::\d+)?$/i.test(host)
            ? `wss://${host}/ws`
            : "'self'";
        }],
      },
    } : false,
  }));
}
