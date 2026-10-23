import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const authIpStore = new Map<string, RateLimitRecord>();

/**
 * Lightweight in-memory rate limiter for sensitive authentication endpoints.
 * Window: 1 minute, Max requests: 15 per IP.
 */
export function authRateLimiter(maxRequests: number = 15, windowMs: number = 60 * 1000) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // In test environment, skip or relax rate limiting
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const record = authIpStore.get(ip);

    if (!record || now > record.resetTime) {
      authIpStore.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
      throw new ApiError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Too many authentication attempts. Please try again in ${waitSeconds} seconds.`
      );
    }

    record.count += 1;
    next();
  };
}
