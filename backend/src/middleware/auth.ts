import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { userRepository, teamRepository } from '../db';
import { ApiError } from '../utils/api-error';
import { TeamRole } from '../types/db.types';
import '../types/auth.types';

/**
 * Parses Bearer token from Authorization header if present,
 * and sets req.user without throwing if unauthenticated.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next();
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next();
    }

    const user = userRepository.getUserById(payload.userId);
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Enforces that an authenticated user is present.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication required. Missing Bearer token.');
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    throw ApiError.unauthorized('Invalid or expired authentication token.');
  }

  const user = userRepository.getUserById(payload.userId);
  if (!user) {
    throw ApiError.unauthorized('Authenticated user no longer exists.');
  }

  req.user = user;
  next();
}

/**
 * Middleware factory ensuring the authenticated user has membership in the requested team.
 */
export function requireTeamRole(
  teamIdParam: string = 'teamId',
  minimumRole?: TeamRole
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = (req.params[teamIdParam] || req.body[teamIdParam] || req.query[teamIdParam]) as string;
      if (!teamId) {
        throw ApiError.badRequest(`Missing team identifier "${teamIdParam}".`);
      }

      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership) {
        throw ApiError.forbidden('You are not a member of this team.');
      }

      if (minimumRole) {
        if (minimumRole === 'owner' && membership.role !== 'owner') {
          throw ApiError.forbidden('Only team owners can perform this operation.');
        }
        if (minimumRole === 'admin' && membership.role !== 'owner' && membership.role !== 'admin') {
          throw ApiError.forbidden('Only team admins or owners can perform this operation.');
        }
      }

      req.teamMembership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Aliases for Phase 2 compatibility
export const authenticate = requireAuth;
export const optionalAuthenticate = optionalAuth;

