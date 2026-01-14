/**
 * Structured Logger with Winston
 *
 * Usage:
 * ```typescript
 * import { logger } from './utils/logger';
 *
 * logger.info('User logged in', { userId: 123, username: 'john' });
 * logger.error('Database connection failed', { error: err.message, stack: err.stack });
 * logger.warn('High memory usage', { usage: '85%' });
 * logger.debug('Query executed', { query: 'SELECT * FROM users', duration: 45 });
 * ```
 */

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Determine log level from environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define transports (where logs go)
const transports: winston.transport[] = [];

// Console transport (for development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...meta } = info;
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        })
      ),
    })
  );
}

// File transports (for production)
if (process.env.NODE_ENV === 'production') {
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // HTTP logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/http.log',
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  );
}

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create a stream object for Morgan middleware
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Log startup information
logger.info('Logger initialized', {
  level: level(),
  environment: process.env.NODE_ENV || 'development',
  transports: transports.map((t) => t.constructor.name),
});

// Helper functions for common logging patterns

/**
 * Log database operation
 */
export const logDbOperation = (
  operation: string,
  table: string,
  meta?: Record<string, any>
) => {
  logger.debug(`Database ${operation}`, { table, ...meta });
};

/**
 * Log API request
 */
export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  meta?: Record<string, any>
) => {
  const level = statusCode >= 400 ? 'warn' : 'http';
  logger.log(level, `${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    duration,
    ...meta,
  });
};

/**
 * Log authentication event
 */
export const logAuth = (
  event: 'login' | 'logout' | 'failed_login' | 'session_expired',
  username: string,
  meta?: Record<string, any>
) => {
  const level = event === 'failed_login' ? 'warn' : 'info';
  logger.log(level, `Auth: ${event}`, { event, username, ...meta });
};

/**
 * Log security event
 */
export const logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  meta?: Record<string, any>
) => {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  logger.log(level, `Security: ${event}`, { event, severity, ...meta });
};

/**
 * Log performance metric
 */
export const logPerformance = (
  operation: string,
  duration: number,
  meta?: Record<string, any>
) => {
  const level = duration > 1000 ? 'warn' : 'debug';
  logger.log(level, `Performance: ${operation}`, { operation, duration, ...meta });
};

/**
 * Sanitize sensitive data before logging
 */
export const sanitize = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = ['password', 'passwordHash', 'token', 'apiKey', 'secret', 'secretCode'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
};

// Export logger as default and named
export default logger;
