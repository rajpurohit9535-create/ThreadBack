import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { User } from '../../types/db.types';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  createUser(email: string, name: string, passwordHash: string): User {
    const db = this.getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = email.trim().toLowerCase();

    const stmt = db.prepare<[string, string, string, string, string, string]>(`
      INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, normalizedEmail, name.trim(), passwordHash, now, now);

    return {
      id,
      email: normalizedEmail,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
  }

  getUserById(id: string): User | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?')
      .get(id);

    return row ? mapUserRow(row) : null;
  }

  getUserByEmail(email: string): (User & { passwordHash: string }) | null {
    const db = this.getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const row = db
      .prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?')
      .get(normalizedEmail);

    if (!row) return null;

    return {
      ...mapUserRow(row),
      passwordHash: row.password_hash,
    };
  }

  listUsers(limit: number = 50): User[] {
    const db = this.getDb();
    const rows = db
      .prepare<[number], UserRow>('SELECT id, email, name, password_hash, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ?')
      .all(limit);

    return rows.map(mapUserRow);
  }
}

export const userRepository = new UserRepository();
