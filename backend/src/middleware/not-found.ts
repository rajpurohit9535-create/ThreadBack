import { Request, Response } from 'express';
import { ApiError } from '../utils/api-error';

export function notFoundHandler(req: Request, res: Response): void {
  const error = ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`);
  res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}
