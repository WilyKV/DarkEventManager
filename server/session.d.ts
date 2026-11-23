import 'express-session';

declare module 'express-session' {
  interface SessionData {
    staffRevision?: string;
    souvenirToken?: string;
    souvenirRemembered?: boolean;
    user?: {
      id: number;
      username: string;
      roles: string[];
    };
    visitor?: {
      participantId: number;
      firstName: string;
      lastName: string;
      secretCode: string;
    };
  }
}
