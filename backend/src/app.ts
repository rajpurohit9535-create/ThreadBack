import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { apiRouter } from './routes';
import { optionalAuth } from './middleware/auth';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';

export function createApp(): Express {
  const app = express();

  // CORS configuration supporting configured frontend origins and local development
  const configuredOrigins = env.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.includes(requestOrigin) || env.corsOrigin === '*') {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Request body parsing with safe size limit
  app.use(express.json({ limit: '1mb' }));

  // Global optional auth (populates req.user if Bearer token present)
  app.use(optionalAuth);

  // Mount API routes
  app.use('/api', apiRouter);

  // Fallback for unmatched routes
  app.use(notFoundHandler);

  // Global centralized error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
