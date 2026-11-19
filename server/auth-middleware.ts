import type { Request, Response, NextFunction } from "express";

/**
 * Middleware to check if user is authenticated.
 * Returns 401 if no session user is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  next();
}

/**
 * Middleware factory to check if user has at least one of the required roles.
 * Returns 401 if not authenticated, 403 if authenticated but without required role.
 * Supports both string[] and JSON-encoded string formats for session roles.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const hasRole = hasSessionRole(req.session.user.roles, roles);
    if (!hasRole) {
      return res.status(403).json({ message: "Accès refusé - Permissions insuffisantes" });
    }

    next();
  };
}


export function hasSessionRole(userRoles: unknown, roles: readonly string[]): boolean {
  let values: unknown = userRoles;
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch { return false; }
  }
  return Array.isArray(values) && roles.some(role => values.includes(role));
}
