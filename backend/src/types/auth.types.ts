import { User, TeamMember } from './db.types';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      teamMembership?: TeamMember;
    }
  }
}

export interface AuthResponse {
  user: User;
  token: string;
}
