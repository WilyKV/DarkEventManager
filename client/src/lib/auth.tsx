import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  roles: string | string[]; // JSON string or parsed array
  rolesList?: string[]; // Parsed roles array
}

interface Visitor {
  participantId: number;
  firstName: string;
  lastName: string;
  secretCode: string;
}

interface AuthContextType {
  user: User | null;
  visitor: Visitor | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAllRoles: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function parseUserRoles<T extends { roles: string | string[] }>(userData: T): T & { rolesList: string[] } {
  try {
    const rawRoles = userData.roles;
    const rolesList = Array.isArray(rawRoles) ? rawRoles : JSON.parse((rawRoles as string) || "[]");
    return { ...userData, rolesList };
  } catch {
    return { ...userData, rolesList: [] };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/session", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(parseUserRoles(data.user) as User);
          setVisitor(null);
        } else if (data.visitor) {
          setVisitor(data.visitor);
          setUser(null);
        }
      } else {
        setUser(null);
        setVisitor(null);
      }
    } catch (error) {
      console.error("Session check error:", error);
      setUser(null);
      setVisitor(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setVisitor(null);
      setLocation("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    
    // Nouveau format (roles array)
    if (user.rolesList && user.rolesList.length > 0) {
      return user.rolesList.includes(role);
    }
    
    // Ancien format (role string) - compatibilité temporaire
    if ((user as any).role) {
      return (user as any).role === role;
    }
    
    return false;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) return false;
    
    // Nouveau format (roles array)
    if (user.rolesList && user.rolesList.length > 0) {
      return roles.some(role => user.rolesList!.includes(role));
    }
    
    // Ancien format (role string) - compatibilité temporaire
    if ((user as any).role) {
      return roles.includes((user as any).role);
    }
    
    return false;
  };

  const hasAllRoles = (roles: string[]): boolean => {
    if (!user) return false;
    
    // Nouveau format (roles array)
    if (user.rolesList && user.rolesList.length > 0) {
      return roles.every(role => user.rolesList!.includes(role));
    }
    
    // Ancien format (role string) - ne peut pas avoir tous les rôles avec un seul rôle
    if ((user as any).role) {
      return roles.length === 1 && roles[0] === (user as any).role;
    }
    
    return false;
  };

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, visitor, isLoading, logout, checkSession, hasRole, hasAnyRole, hasAllRoles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// HOC to protect routes - now supports multiple roles
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, visitor, isLoading, hasAnyRole } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user && !visitor) {
      setLocation("/login");
    } else if (!isLoading && user && roles && roles.length > 0 && !hasAnyRole(roles)) {
      setLocation("/overview");
    }
  }, [user, visitor, isLoading, roles, setLocation, hasAnyRole]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user && !visitor) {
    return null;
  }

  if (roles && roles.length > 0 && user && !hasAnyRole(roles)) {
    return null;
  }

  return <>{children}</>;
}

// HOC for visitor-only routes
export function RequireVisitor({ children }: { children: ReactNode }) {
  const { visitor, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !visitor) {
      setLocation("/login");
    }
  }, [visitor, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!visitor) {
    return null;
  }

  return <>{children}</>;
}
