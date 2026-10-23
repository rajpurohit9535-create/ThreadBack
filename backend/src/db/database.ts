import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initializeSchema } from './schema';

/**
 * Resolves the SQLite database path reliably across working directories.
 * The canonical database is ALWAYS located at backend/data/sidequest.db.
 * If DATABASE_PATH or SQLITE_DB_PATH is explicitly set in the environment, that path is honored.
 */
export function resolveDefaultDbPath(): string {
  const envPath = process.env.DATABASE_PATH?.trim() || process.env.SQLITE_DB_PATH?.trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }

  // Canonical location: backend/data/sidequest.db
  return path.resolve(__dirname, '..', '..', 'data', 'sidequest.db');
}

export const DEFAULT_DB_PATH = resolveDefaultDbPath();

let activeDb: Database.Database | null = null;

/**
 * Initializes and configures the SQLite database instance.
 * Automatically creates parent directories, sets pragmas, and applies schema.
 */
export function initDatabase(dbPath: string = resolveDefaultDbPath()): Database.Database {
  if (activeDb) {
    return activeDb;
  }

  // Ensure directory exists if not an in-memory database
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');

  // Configure WAL mode for concurrency and performance (file-based dbs)
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Prevent lock errors under concurrent operations
  db.pragma('busy_timeout = 5000');

  // Initialize all tables and indexes
  initializeSchema(db);

  activeDb = db;
  return db;
}

/**
 * Returns the currently active database instance.
 * Initializes the default database if not already open.
 */
export function getDatabase(): Database.Database {
  if (!activeDb) {
    return initDatabase();
  }
  return activeDb;
}

/**
 * Closes active database connection (useful for tests and graceful shutdown).
 */
export function closeDatabase(): void {
  if (activeDb) {
    try {
      activeDb.close();
    } finally {
      activeDb = null;
    }
  }
}
