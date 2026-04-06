import type { JwtPayload } from 'jsonwebtoken';

export type AuthUser = JwtPayload & {
  id: string;
  email?: string;
  role?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};