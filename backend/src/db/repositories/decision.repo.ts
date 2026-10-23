import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { SharedDecision, DecisionCategory } from '../../types/db.types';

interface SharedDecisionRow {
  id: string;
  mission_id: string;
  decision: string;
  category: DecisionCategory;
  contributed_by: string;
  contributor_name: string;
  source_conversation_id: string | null;
  created_at: string;
}

function mapRow(row: SharedDecisionRow): SharedDecision {
  return {
    id: row.id,
    missionId: row.mission_id,
    decision: row.decision,
    category: row.category,
    contributedBy: row.contributed_by,
    contributorName: row.contributor_name,
    sourceConversationId: row.source_conversation_id,
    createdAt: row.created_at,
  };
}

export class DecisionRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  addDecision(
    missionId: string,
    decision: string,
    category: DecisionCategory = 'decision',
    contributedBy: string,
    contributorName: string,
    sourceConversationId?: string | null
  ): SharedDecision {
    const db = this.getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare<[string, string, string, string, string, string, string | null, string]>(`
      INSERT INTO shared_decisions (id, mission_id, decision, category, contributed_by, contributor_name, source_conversation_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      missionId,
      decision.trim(),
      category,
      contributedBy,
      contributorName.trim(),
      sourceConversationId || null,
      now
    );

    return {
      id,
      missionId,
      decision: decision.trim(),
      category,
      contributedBy,
      contributorName: contributorName.trim(),
      sourceConversationId: sourceConversationId || null,
      createdAt: now,
    };
  }

  listMissionDecisions(missionId: string): SharedDecision[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string], SharedDecisionRow>(`
        SELECT * FROM shared_decisions 
        WHERE mission_id = ? 
        ORDER BY created_at ASC
      `)
      .all(missionId);

    return rows.map(mapRow);
  }

  deleteDecision(decisionId: string, missionId: string): boolean {
    const db = this.getDb();
    const res = db
      .prepare<[string, string]>('DELETE FROM shared_decisions WHERE id = ? AND mission_id = ?')
      .run(decisionId, missionId);

    return res.changes > 0;
  }
}

export const decisionRepository = new DecisionRepository();
