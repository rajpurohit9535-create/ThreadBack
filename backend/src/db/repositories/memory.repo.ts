import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import {
  MissionMemory,
  SideQuestMemory,
  SideQuestLearningSummary,
} from '../../types/db.types';

interface MissionMemoryRow {
  id: string;
  mission_id: string;
  summary: string;
  progress: string;
  decisions: string;
  blockers: string;
  next_step: string;
  updated_at: string;
}

interface SideQuestMemoryRow {
  id: string;
  conversation_id: string;
  learning_summary: string;
  unresolved_questions: string;
  is_incorporated?: number;
  updated_at: string;
}

export interface UpsertMissionMemoryParams {
  missionId: string;
  summary: string;
  progress: string;
  decisions: string[];
  blockers: string[];
  nextStep: string;
}

export interface UpsertSideQuestMemoryParams {
  conversationId: string;
  learningSummary: string;
  unresolvedQuestions: string[];
  isIncorporated?: boolean;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapMissionMemoryRow(row: MissionMemoryRow): MissionMemory {
  return {
    id: row.id,
    missionId: row.mission_id,
    summary: row.summary,
    progress: row.progress,
    decisions: parseJsonArray(row.decisions),
    blockers: parseJsonArray(row.blockers),
    nextStep: row.next_step,
    updatedAt: row.updated_at,
  };
}

function mapSideQuestMemoryRow(row: SideQuestMemoryRow): SideQuestMemory {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    learningSummary: row.learning_summary,
    unresolvedQuestions: parseJsonArray(row.unresolved_questions),
    isIncorporated: Boolean(row.is_incorporated),
    updatedAt: row.updated_at,
  };
}

function parseStructuredSummary(row: SideQuestMemoryRow): SideQuestLearningSummary {
  try {
    const parsed = JSON.parse(row.learning_summary);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.keyLearnings)) {
      return {
        topic: String(parsed.topic || 'SideQuest Exploration'),
        keyLearnings: Array.isArray(parsed.keyLearnings) ? parsed.keyLearnings : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        usefulExamples: Array.isArray(parsed.usefulExamples) ? parsed.usefulExamples : [],
        unresolvedQuestions: Array.isArray(parsed.unresolvedQuestions)
          ? parsed.unresolvedQuestions
          : parseJsonArray(row.unresolved_questions),
        missionRelevance: String(parsed.missionRelevance || ''),
      };
    }
  } catch {
    // Fallback if learning_summary is plain text
  }

  return {
    topic: 'SideQuest Exploration',
    keyLearnings: [row.learning_summary],
    decisions: [],
    usefulExamples: [],
    unresolvedQuestions: parseJsonArray(row.unresolved_questions),
    missionRelevance: '',
  };
}

export class MemoryRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  /**
   * Retrieves memory record for a mission.
   */
  getMissionMemory(missionId: string): MissionMemory | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], MissionMemoryRow>('SELECT * FROM mission_memories WHERE mission_id = ?')
      .get(missionId);

    return row ? mapMissionMemoryRow(row) : null;
  }

  /**
   * Upserts mission memory record (at most one per mission).
   */
  upsertMissionMemory(params: UpsertMissionMemoryParams): MissionMemory {
    const db = this.getDb();
    const existing = this.getMissionMemory(params.missionId);
    const id = existing ? existing.id : randomUUID();
    const now = new Date().toISOString();
    const decisionsJson = JSON.stringify(params.decisions);
    const blockersJson = JSON.stringify(params.blockers);

    const stmt = db.prepare(`
      INSERT INTO mission_memories (id, mission_id, summary, progress, decisions, blockers, next_step, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mission_id) DO UPDATE SET
        summary = excluded.summary,
        progress = excluded.progress,
        decisions = excluded.decisions,
        blockers = excluded.blockers,
        next_step = excluded.next_step,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      id,
      params.missionId,
      params.summary,
      params.progress,
      decisionsJson,
      blockersJson,
      params.nextStep,
      now
    );

    return {
      id,
      missionId: params.missionId,
      summary: params.summary,
      progress: params.progress,
      decisions: params.decisions,
      blockers: params.blockers,
      nextStep: params.nextStep,
      updatedAt: now,
    };
  }

  /**
   * Intelligently merges decisions and progress into mission memory without erasing existing data.
   */
  mergeDecisionsIntoMissionMemory(
    missionId: string,
    newDecisions: string[],
    summaryFallback?: string
  ): MissionMemory {
    const existing = this.getMissionMemory(missionId);
    const combinedDecisions = existing
      ? Array.from(new Set([...existing.decisions, ...newDecisions]))
      : newDecisions;

    const summary = existing && existing.summary.trim().length > 0
      ? existing.summary
      : summaryFallback || '';

    const progress = existing && existing.progress.trim().length > 0
      ? existing.progress
      : newDecisions.length > 0
        ? 'Incorporated SideQuest decisions into mission plan.'
        : '';

    const blockers = existing ? existing.blockers : [];
    const nextStep = existing ? existing.nextStep : '';

    return this.upsertMissionMemory({
      missionId,
      summary,
      progress,
      decisions: combinedDecisions,
      blockers,
      nextStep,
    });
  }

  /**
   * Retrieves SideQuest memory for a conversation.
   */
  getSideQuestMemory(conversationId: string): SideQuestMemory | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], SideQuestMemoryRow>('SELECT * FROM sidequest_memories WHERE conversation_id = ?')
      .get(conversationId);

    return row ? mapSideQuestMemoryRow(row) : null;
  }

  /**
   * Retrieves structured SideQuest learning summary if available.
   */
  getSideQuestStructuredSummary(conversationId: string): SideQuestLearningSummary | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], SideQuestMemoryRow>('SELECT * FROM sidequest_memories WHERE conversation_id = ?')
      .get(conversationId);

    return row ? parseStructuredSummary(row) : null;
  }

  /**
   * Upserts SideQuest memory record (at most one per SideQuest conversation).
   */
  upsertSideQuestMemory(params: UpsertSideQuestMemoryParams): SideQuestMemory {
    const db = this.getDb();
    const existing = this.getSideQuestMemory(params.conversationId);
    const id = existing ? existing.id : randomUUID();
    const now = new Date().toISOString();
    const questionsJson = JSON.stringify(params.unresolvedQuestions);
    const isInc = params.isIncorporated ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO sidequest_memories (id, conversation_id, learning_summary, unresolved_questions, is_incorporated, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        learning_summary = excluded.learning_summary,
        unresolved_questions = excluded.unresolved_questions,
        is_incorporated = excluded.is_incorporated,
        updated_at = excluded.updated_at
    `);

    stmt.run(id, params.conversationId, params.learningSummary, questionsJson, isInc, now);

    return {
      id,
      conversationId: params.conversationId,
      learningSummary: params.learningSummary,
      unresolvedQuestions: params.unresolvedQuestions,
      isIncorporated: Boolean(params.isIncorporated),
      updatedAt: now,
    };
  }

  /**
   * Saves or updates a structured SideQuest learning summary in sidequest_memories.
   * Sets is_incorporated to 0 so the next Main AI interaction can consume it.
   */
  upsertSideQuestStructuredSummary(
    conversationId: string,
    summary: SideQuestLearningSummary
  ): SideQuestMemory {
    return this.upsertSideQuestMemory({
      conversationId,
      learningSummary: JSON.stringify(summary),
      unresolvedQuestions: summary.unresolvedQuestions || [],
      isIncorporated: false,
    });
  }

  /**
   * Retrieves unincorporated SideQuest summaries for a mission, bounded by limit.
   */
  getUnincorporatedSideQuestSummaries(
    missionId: string,
    limit = 2
  ): Array<{ conversationId: string; summary: SideQuestLearningSummary; updatedAt: string }> {
    const db = this.getDb();
    const rows = db
      .prepare<[string, number], SideQuestMemoryRow>(`
        SELECT sm.*
        FROM sidequest_memories sm
        JOIN conversations c ON sm.conversation_id = c.id
        WHERE c.mission_id = ? AND c.type = 'sidequest' AND (sm.is_incorporated = 0 OR sm.is_incorporated IS NULL)
        ORDER BY sm.updated_at DESC, sm.rowid DESC
        LIMIT ?
      `)
      .all(missionId, limit);

    return rows.map((r) => ({
      conversationId: r.conversation_id,
      summary: parseStructuredSummary(r),
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Retrieves all completed SideQuest summaries for a mission, bounded by limit.
   */
  getAllSideQuestSummariesByMissionId(
    missionId: string,
    limit = 5
  ): Array<{ conversationId: string; summary: SideQuestLearningSummary; updatedAt: string }> {
    const db = this.getDb();
    const rows = db
      .prepare<[string, number], SideQuestMemoryRow>(`
        SELECT sm.*
        FROM sidequest_memories sm
        JOIN conversations c ON sm.conversation_id = c.id
        WHERE c.mission_id = ? AND c.type = 'sidequest'
        ORDER BY sm.updated_at DESC, sm.rowid DESC
        LIMIT ?
      `)
      .all(missionId, limit);

    return rows.map((r) => ({
      conversationId: r.conversation_id,
      summary: parseStructuredSummary(r),
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Marks given SideQuest summaries as incorporated into Main AI context.
   */
  markSideQuestSummariesIncorporated(conversationIds: string[]): void {
    if (conversationIds.length === 0) return;
    const db = this.getDb();
    const placeholders = conversationIds.map(() => '?').join(',');
    db.prepare(`UPDATE sidequest_memories SET is_incorporated = 1 WHERE conversation_id IN (${placeholders})`)
      .run(...conversationIds);
  }
}

export const memoryRepository = new MemoryRepository();

