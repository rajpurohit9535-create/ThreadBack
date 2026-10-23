import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import {
  Mission,
  Conversation,
  CreateMissionResult,
  MissionWithConversations,
  MissionStatus,
} from '../../types/db.types';
import { DecisionRepository } from './decision.repo';

interface MissionRow {
  id: string;
  objective: string;
  status: MissionStatus;
  project_id?: string | null;
  team_id?: string | null;
  user_id?: string | null;
  visibility?: 'personal' | 'team';
  created_at: string;
  updated_at: string;
}

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

function mapMissionRow(row: MissionRow): Mission {
  return {
    id: row.id,
    objective: row.objective,
    status: row.status,
    projectId: row.project_id || null,
    teamId: row.team_id || null,
    userId: row.user_id || null,
    visibility: row.visibility || (row.team_id ? 'team' : 'personal'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export interface CreateMissionOptions {
  projectId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  visibility?: 'personal' | 'team';
}

export interface ListMissionsOptions {
  projectId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  limit?: number;
}

export class MissionRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  /**
   * Creates a new mission and its associated 'main' conversation within an atomic transaction.
   */
  createMissionWithMainConversation(
    objective: string,
    options?: CreateMissionOptions
  ): CreateMissionResult {
    const db = this.getDb();
    const missionId = randomUUID();
    const conversationId = randomUUID();
    const now = new Date().toISOString();

    const projectId = options?.projectId || null;
    const teamId = options?.teamId || null;
    const userId = options?.userId || null;
    const visibility = options?.visibility || (teamId ? 'team' : 'personal');

    const insertMission = db.prepare<[string, string, string | null, string | null, string | null, string, string, string]>(`
      INSERT INTO missions (id, objective, status, project_id, team_id, user_id, visibility, created_at, updated_at)
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)
    `);

    const insertConversation = db.prepare<[string, string, string | null, string, string]>(`
      INSERT INTO conversations (id, mission_id, type, topic, user_id, is_shared, created_at, updated_at)
      VALUES (?, ?, 'main', NULL, ?, 1, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertMission.run(missionId, objective.trim(), projectId, teamId, userId, visibility, now, now);
      insertConversation.run(conversationId, missionId, userId, now, now);
    });

    transaction();

    return {
      mission: {
        id: missionId,
        objective: objective.trim(),
        status: 'active',
        projectId,
        teamId,
        userId,
        visibility,
        createdAt: now,
        updatedAt: now,
      },
      mainConversation: {
        id: conversationId,
        missionId,
        type: 'main',
        topic: null,
        userId,
        isShared: true,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /**
   * Retrieves a mission by its ID.
   */
  getMissionById(id: string): Mission | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], MissionRow>('SELECT * FROM missions WHERE id = ?')
      .get(id);

    return row ? mapMissionRow(row) : null;
  }

  /**
   * Retrieves a mission together with all accessible conversations (main and sidequests),
   * and any approved shared decisions.
   * If viewerUserId is passed, private sidequests belonging to other users are filtered out.
   */
  getMissionWithConversations(id: string, viewerUserId?: string | null): MissionWithConversations | null {
    const db = this.getDb();
    const missionRow = db
      .prepare<[string], MissionRow>('SELECT * FROM missions WHERE id = ?')
      .get(id);

    if (!missionRow) return null;

    let conversationRows: ConversationRow[];
    if (viewerUserId) {
      conversationRows = db
        .prepare<[string, string], ConversationRow>(`
          SELECT * FROM conversations 
          WHERE mission_id = ? AND (is_shared = 1 OR user_id = ?) 
          ORDER BY created_at ASC
        `)
        .all(id, viewerUserId);
    } else {
      conversationRows = db
        .prepare<[string], ConversationRow>(
          'SELECT * FROM conversations WHERE mission_id = ? ORDER BY created_at ASC'
        )
        .all(id);
    }

    const decisions = new DecisionRepository(this.getDb).listMissionDecisions(id);

    return {
      mission: mapMissionRow(missionRow),
      conversations: conversationRows.map(mapConversationRow),
      decisions,
    };
  }

  /**
   * Lists missions, optionally scoped to a team or personal workspace.
   */
  listMissions(options?: ListMissionsOptions | number): Mission[] {
    const db = this.getDb();
    let limit = 50;
    let teamId: string | null = null;
    let userId: string | null = null;

    if (typeof options === 'number') {
      limit = options;
    } else if (options) {
      limit = options.limit || 50;
      teamId = options.teamId || null;
      userId = options.userId || null;
    }

    const projectId = typeof options === 'object' && options ? options.projectId || null : null;

    let rows: MissionRow[];

    if (projectId) {
      rows = db
        .prepare<[string, number], MissionRow>(`
          SELECT * FROM missions 
          WHERE project_id = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        .all(projectId, limit);
    } else if (teamId) {
      // List team shared missions
      rows = db
        .prepare<[string, number], MissionRow>(`
          SELECT * FROM missions 
          WHERE team_id = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        .all(teamId, limit);
    } else if (userId) {
      // List personal missions owned strictly by this user
      rows = db
        .prepare<[string, number], MissionRow>(`
          SELECT * FROM missions 
          WHERE user_id = ? AND team_id IS NULL
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        .all(userId, limit);
    } else {
      // Backward-compatible listing for guests: only unassigned missions
      rows = db
        .prepare<[number], MissionRow>(`
          SELECT * FROM missions 
          WHERE team_id IS NULL AND user_id IS NULL
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        .all(limit);
    }

    return rows.map(mapMissionRow);
  }

  /**
   * Updates mission status and updated_at timestamp.
   */
  updateMissionStatus(id: string, status: MissionStatus): boolean {
    const db = this.getDb();
    const now = new Date().toISOString();
    const result = db
      .prepare<[string, string, string]>('UPDATE missions SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id);

    return result.changes > 0;
  }

  /**
   * Claims an unowned legacy mission for an authenticated user.
   */
  claimMission(id: string, userId: string): boolean {
    const db = this.getDb();
    const now = new Date().toISOString();
    const result = db
      .prepare<[string, string, string]>('UPDATE missions SET user_id = ?, updated_at = ? WHERE id = ? AND user_id IS NULL AND team_id IS NULL')
      .run(userId, now, id);

    return result.changes > 0;
  }

  /**
   * Promotes a personal mission to a shared team mission.
   */
  shareMissionWithTeam(id: string, teamId: string, userId: string): boolean {
    const db = this.getDb();
    const now = new Date().toISOString();
    const result = db
      .prepare<[string, string, string, string]>('UPDATE missions SET team_id = ?, visibility = \'team\', updated_at = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)')
      .run(teamId, now, id, userId);

    return result.changes > 0;
  }
}

export const missionRepository = new MissionRepository();
