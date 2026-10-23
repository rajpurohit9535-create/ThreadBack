import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { userRepository, teamRepository } from '../db';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth';
import { ApiError } from '../utils/api-error';

export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new user with hashed password and returns an auth token.
   */
  static register(req: Request, res: Response, next: NextFunction): void {
    try {
      const validated = registerSchema.parse(req.body);
      const existing = userRepository.getUserByEmail(validated.email);
      if (existing) {
        throw ApiError.badRequest('An account with this email already exists.');
      }

      const passwordHash = hashPassword(validated.password);
      const user = userRepository.createUser(validated.email, validated.name, passwordHash);
      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      });

      res.status(201).json({
        user,
        token,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Validates credentials and returns an auth token.
   */
  static login(req: Request, res: Response, next: NextFunction): void {
    try {
      const validated = loginSchema.parse(req.body);
      const userWithHash = userRepository.getUserByEmail(validated.email);

      if (!userWithHash || !verifyPassword(validated.password, userWithHash.passwordHash)) {
        throw ApiError.unauthorized('Invalid email or password.');
      }

      const user = {
        id: userWithHash.id,
        email: userWithHash.email,
        name: userWithHash.name,
        createdAt: userWithHash.createdAt,
        updatedAt: userWithHash.updatedAt,
      };

      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      });

      res.status(200).json({
        user,
        token,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user and their teams.
   */
  static me(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Not authenticated.');
      }

      const teams = teamRepository.listUserTeams(req.user.id);
      res.status(200).json({
        user: req.user,
        teams,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/dev-users
   * Returns list of existing registered mock accounts.
   * Gated strictly to development / test environments.
   */
  static listDevUsers(_req: Request, res: Response, next: NextFunction): void {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw ApiError.forbidden('Developer user switching is disabled in production.');
      }

      const users = userRepository.listUsers(50);
      res.status(200).json({ users });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/dev-switch
   * Switches to an existing registered mock user by ID and issues a valid signed token.
   * Gated strictly to development / test environments.
   */
  static devSwitch(req: Request, res: Response, next: NextFunction): void {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw ApiError.forbidden('Developer user switching is disabled in production.');
      }

      const { userId } = req.body;
      if (!userId || typeof userId !== 'string') {
        throw ApiError.badRequest('Valid userId is required.');
      }

      const user = userRepository.getUserById(userId);
      if (!user) {
        throw ApiError.notFound(`Mock user with ID ${userId} not found.`);
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      });

      res.status(200).json({
        user,
        token,
      });
    } catch (error) {
      next(error);
    }
  }
}
