import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Explicitly load .env before loading application modules
const envCandidates = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

import { app } from './app';
import { env } from './config/env';
import { initDatabase, closeDatabase, DEFAULT_DB_PATH } from './db';

function startServer(): void {
  try {
    // Automatically initialize database schema on startup
    initDatabase();
    console.log(`[THREADBACK Backend] SQLite database initialized at ${DEFAULT_DB_PATH}`);

    const server = app.listen(env.port, () => {
      console.log(`[SIDEQUEST Backend] Server listening on http://localhost:${env.port}`);
      console.log(`[SIDEQUEST Backend] Model: ${env.gemmaModel}`);
      console.log(`[SIDEQUEST Backend] AI Service configured: ${env.isAiConfigured ? 'YES' : 'NO (Set GEMINI_API_KEY in .env)'}`);
    });

    const gracefulShutdown = (signal: string) => {
      console.log(`[SIDEQUEST Backend] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        closeDatabase();
        console.log('[SIDEQUEST Backend] HTTP server and database connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('[SIDEQUEST Backend] Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

startServer();
