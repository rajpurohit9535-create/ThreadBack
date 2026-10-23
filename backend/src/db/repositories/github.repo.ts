import { getDatabase } from '../database';
import {
  GitHubConnection,
  SanitizedGitHubConnection,
  GitHubAccountType,
  GitHubConnectionStatus,
} from '../../types/db.types';
import { encryptToken, decryptToken } from '../../utils/crypto';
import crypto from 'crypto';

interface GitHubConnectionRow {
  id: string;
  user_id: string;
  account_id: string;
  account_login: string;
  account_type: GitHubAccountType;
  encrypted_access_token: string;
  token_iv: string;
  token_tag: string;
  scope: string | null;
  token_type: string;
  status: GitHubConnectionStatus;
  connected_at: string;
  updated_at: string;
}

function mapRowToConnection(row: GitHubConnectionRow): GitHubConnection {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    accountLogin: row.account_login,
    accountType: row.account_type,
    encryptedAccessToken: row.encrypted_access_token,
    tokenIv: row.token_iv,
    tokenTag: row.token_tag,
    scope: row.scope,
    tokenType: row.token_type,
    status: row.status,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
  };
}

export function sanitizeGitHubConnection(connection: GitHubConnection): SanitizedGitHubConnection {
  return {
    id: connection.id,
    accountId: connection.accountId,
    accountLogin: connection.accountLogin,
    accountType: connection.accountType,
    scope: connection.scope,
    status: connection.status,
    connectedAt: connection.connectedAt,
    updatedAt: connection.updatedAt,
  };
}

export interface SaveConnectionParams {
  userId: string;
  accountId: string;
  accountLogin: string;
  accountType?: GitHubAccountType;
  accessToken: string;
  scope?: string | null;
  tokenType?: string;
}

export const githubRepository = {
  saveConnection(params: SaveConnectionParams): SanitizedGitHubConnection {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { encrypted, iv, tag } = encryptToken(params.accessToken);

    db.prepare(`
      INSERT INTO github_connections (
        id, user_id, account_id, account_login, account_type,
        encrypted_access_token, token_iv, token_tag, scope, token_type,
        status, connected_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(user_id, account_id) DO UPDATE SET
        account_login = excluded.account_login,
        account_type = excluded.account_type,
        encrypted_access_token = excluded.encrypted_access_token,
        token_iv = excluded.token_iv,
        token_tag = excluded.token_tag,
        scope = excluded.scope,
        token_type = excluded.token_type,
        status = 'active',
        updated_at = excluded.updated_at
    `).run(
      id,
      params.userId,
      params.accountId,
      params.accountLogin,
      params.accountType || 'user',
      encrypted,
      iv,
      tag,
      params.scope || null,
      params.tokenType || 'bearer',
      now,
      now
    );

    const saved = db.prepare(`
      SELECT * FROM github_connections WHERE user_id = ? AND account_id = ?
    `).get(params.userId, params.accountId) as GitHubConnectionRow;

    return sanitizeGitHubConnection(mapRowToConnection(saved));
  },

  getConnectionByUserId(userId: string): GitHubConnection | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM github_connections 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `).get(userId) as GitHubConnectionRow | undefined;

    return row ? mapRowToConnection(row) : null;
  },

  getDecryptedAccessToken(userId: string): string | null {
    const conn = this.getConnectionByUserId(userId);
    if (!conn || conn.status !== 'active') return null;

    try {
      return decryptToken(conn.encryptedAccessToken, conn.tokenIv, conn.tokenTag);
    } catch {
      return null;
    }
  },

  disconnect(userId: string): boolean {
    const db = getDatabase();
    const now = new Date().toISOString();
    const info = db.prepare(`
      UPDATE github_connections 
      SET status = 'disconnected', updated_at = ?
      WHERE user_id = ? AND status != 'disconnected'
    `).run(now, userId);

    return info.changes > 0;
  },

  markRevoked(userId: string): boolean {
    const db = getDatabase();
    const now = new Date().toISOString();
    const info = db.prepare(`
      UPDATE github_connections 
      SET status = 'revoked', updated_at = ?
      WHERE user_id = ?
    `).run(now, userId);

    return info.changes > 0;
  },

  deleteConnection(userId: string): boolean {
    const db = getDatabase();
    const info = db.prepare('DELETE FROM github_connections WHERE user_id = ?').run(userId);
    return info.changes > 0;
  },
};
