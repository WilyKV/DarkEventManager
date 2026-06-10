import { SESSION_COOKIE_MAX_AGE_MS } from './config/limits';

export function getSessionCookieOptions(env: NodeJS.ProcessEnv): {
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
} {
  return {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  };
}
