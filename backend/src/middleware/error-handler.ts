import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Handled application ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 2. Zod validation failure
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request body is invalid.',
        details: formattedErrors,
      },
    });
    return;
  }

  // 3. Malformed JSON payload syntax error
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Malformed JSON payload in request body.',
      },
    });
    return;
  }

  // 4. Request entity too large
  if ('type' in err && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request payload exceeds the allowed size limit.',
      },
    });
    return;
  }

  // 5. Unhandled / generic server errors
  console.error(`[UnhandledError] ${req.method} ${req.path}:`, err instanceof Error ? err.name : 'UnknownError');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
    },
  });
};
