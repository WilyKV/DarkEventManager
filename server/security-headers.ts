import helmet from 'helmet';
import type { Express } from 'express';

export function applySecurityHeaders(app: Express): void {
  app.disable('x-powered-by');
  const isProduction = process.env['NODE_ENV'] === 'production';
  app.use(helmet({ contentSecurityPolicy: isProduction }));
}
