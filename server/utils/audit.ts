/**
 * Audit Logging Utilities
 *
 * Provides functions to create audit logs for CRUD operations
 */

import type { Request } from 'express';
import { storage } from '../storage';
import { logger } from './logger';

/**
 * Create an audit log entry for a database operation
 */
export async function createAuditLog(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: number | null,
  req: Request,
  recordData?: any,
  changes?: any
) {
  try {
    const user = (req as any).session?.user;

    await storage.createAuditLog({
      userId: user?.id || null,
      username: user?.username || 'anonymous',
      action,
      tableName,
      recordId,
      recordData: recordData ? JSON.stringify(recordData) : null,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('user-agent') || null,
    });

    logger.info('Audit log created', {
      action,
      tableName,
      recordId,
      userId: user?.id,
      username: user?.username,
    });
  } catch (error: any) {
    logger.error('Failed to create audit log', {
      error: error.message,
      action,
      tableName,
      recordId,
    });
    // Ne pas bloquer l'opération si le logging échoue
  }
}
