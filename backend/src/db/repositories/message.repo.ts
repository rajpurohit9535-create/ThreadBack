import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { Message, MessageRole } from '../../types/db.types';

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  user_id?: string | null;
  user_name?: string | null;
  created_at: string;
}

function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    userId: row.user_id || null,
    userName: row.user_name || null,
    createdAt: row.created_at,
  };
}

export interface CreateMessageOptions {
  userId?: string | null;
  userName?: string | null;
}

export class MessageRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  /**
   * Persists a message for a conversation.
   */
  createMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    options?: CreateMessageOptions
  ): Message {
    const db = this.getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    const userId = options?.userId || null;
    const userName = options?.userName || null;

    const insert = db.prepare<[string, string, string, string, string | null, string | null, string]>(`
      INSERT INTO messages (id, conversation_id, role, content, user_id, user_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(id, conversationId, role, content, userId, userName, now);

    return {
      id,
      conversationId,
      role,
      content,
      userId,
      userName,
      createdAt: now,
    };
  }

  /**
   * Retrieves messages for a conversation in chronological order.
   */
  getMessagesByConversationId(conversationId: string, limit = 100): Message[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string, number], MessageRow>(
        'SELECT id, conversation_id, role, content, user_id, user_name, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC LIMIT ?'
      )
      .all(conversationId, limit);

    return rows.map(mapMessageRow);
  }

  /**
   * Retrieves a sliding context window of the most recent messages, returned in chronological order.
   * Useful for AI prompt context without sending thousands of historical turns.
   */
  getRecentContextMessages(conversationId: string, windowSize = 30): Message[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string, number], MessageRow>(`
        SELECT id, conversation_id, role, content, user_id, user_name, created_at FROM (
          SELECT id, conversation_id, role, content, user_id, user_name, created_at, rowid 
          FROM messages 
          WHERE conversation_id = ? 
          ORDER BY created_at DESC, rowid DESC 
          LIMIT ?
        ) ORDER BY created_at ASC, rowid ASC
      `)
      .all(conversationId, windowSize);

    return rows.map(mapMessageRow);
  }

  /**
   * Deletes a message by ID. Useful for rolling back user message if generation fails.
   */
  deleteMessage(id: string): void {
    const db = this.getDb();
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  }
}

export const messageRepository = new MessageRepository();
