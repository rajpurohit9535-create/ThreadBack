import { getDatabase } from '../database';
import { ProjectFeedback } from '../../types/db.types';
import crypto from 'crypto';

interface FeedbackRow {
  id: string;
  project_id: string | null;
  user_id: string | null;
  user_name: string | null;
  target_type: 'repo_analysis' | 'mission' | 'sidequest';
  target_id: string | null;
  rating: number | null;
  comment: string;
  created_at: string;
}

function mapRowToFeedback(row: FeedbackRow): ProjectFeedback {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.user_name,
    targetType: row.target_type,
    targetId: row.target_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export interface CreateFeedbackParams {
  projectId?: string | null;
  userId?: string | null;
  userName?: string | null;
  targetType: 'repo_analysis' | 'mission' | 'sidequest';
  targetId?: string | null;
  rating?: number | null;
  comment: string;
}

export const feedbackRepository = {
  createFeedback(params: CreateFeedbackParams): ProjectFeedback {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO project_feedback (
        id, project_id, user_id, user_name, target_type, target_id, rating, comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.projectId || null,
      params.userId || null,
      params.userName || null,
      params.targetType,
      params.targetId || null,
      params.rating || null,
      params.comment,
      now
    );

    const saved = db.prepare('SELECT * FROM project_feedback WHERE id = ?').get(id) as FeedbackRow;
    return mapRowToFeedback(saved);
  },

  listFeedbackByProject(projectId: string): ProjectFeedback[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM project_feedback 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `).all(projectId) as FeedbackRow[];

    return rows.map(mapRowToFeedback);
  },

  listFeedbackByTarget(targetType: string, targetId: string): ProjectFeedback[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM project_feedback 
      WHERE target_type = ? AND target_id = ? 
      ORDER BY created_at DESC
    `).all(targetType, targetId) as FeedbackRow[];

    return rows.map(mapRowToFeedback);
  },
};
