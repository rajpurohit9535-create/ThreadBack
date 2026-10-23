import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { Conversation } from '../../types/db.types';

interface ConversationRow {
  id: string;
  mission_id: string;
  type: 'main' | 'sidequest';
  topic: string | null;
  user_id?: string | null;
  is_shared?: number;
  created_at: string;
  updated_at: string;
}

function mapConversationRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    missionId: row.mission_id,
    type: row.type,
    topic: row.topic,
    userId: row.user_id || null,
    isShared: row.is_shared === undefined || row.is_shared === null ? true : Boolean(row.is_shared),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSideQuestOptions {
  userId?: string | null;
  isShared?: boolean;
}

export class ConversationRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  /**
   * Retrieves a conversation by ID.
   */
  getConversationById(id: string): Conversation | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], ConversationRow>('SELECT * FROM conversations WHERE id = ?')
      .get(id);

    return row ? mapConversationRow(row) : null;
  }

  /**
   * Creates a new SideQuest conversation linked to an existing mission.
   */
  createSideQuestConversation(
    missionId: string,
    topic: string,
    options?: CreateSideQuestOptions
  ): Conversation {
    const db = this.getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    const userId = options?.userId || null;
    const isShared = options?.isShared === undefined ? 1 : options.isShared ? 1 : 0;

    const insert = db.prepare<[string, string, string, string | null, number, string, string]>(`
      INSERT INTO conversations (id, mission_id, type, topic, user_id, is_shared, created_at, updated_at)
      VALUES (?, ?, 'sidequest', ?, ?, ?, ?, ?)
    `);

    insert.run(id, missionId, topic.trim(), userId, isShared, now, now);

    return {
      id,
      missionId,
      type: 'sidequest',
      topic: topic.trim(),
      userId,
      isShared: Boolean(isShared),
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Retrieves all conversations for a mission.
   */
  getConversationsByMissionId(missionId: string): Conversation[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string], ConversationRow>(
        'SELECT * FROM conversations WHERE mission_id = ? ORDER BY created_at ASC'
      )
      .all(missionId);

    return rows.map(mapConversationRow);
  }

  /**
   * Retrieves the primary 'main' conversation for a mission.
   */
  getMainConversationByMissionId(missionId: string): Conversation | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], ConversationRow>(
        "SELECT * FROM conversations WHERE mission_id = ? AND type = 'main'"
      )
      .get(missionId);

    return row ? mapConversationRow(row) : null;
  }

  /**
   * Toggles the sharing status of a sidequest conversation.
   */
  toggleShareConversation(id: string, isShared: boolean): boolean {
    const db = this.getDb();
    const now = new Date().toISOString();
    const res = db
      .prepare<[number, string, string]>('UPDATE conversations SET is_shared = ?, updated_at = ? WHERE id = ?')
      .run(isShared ? 1 : 0, now, id);

    return res.changes > 0;
  }

  /**
   * Updates conversation timestamp.
   */
  touchConversation(id: string): void {
    const db = this.getDb();
    const now = new Date().toISOString();
    db.prepare<[string, string]>('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);
  }
}

export const conversationRepository = new ConversationRepository();
