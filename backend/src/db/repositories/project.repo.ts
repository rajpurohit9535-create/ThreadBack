import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { Project, ProjectStatus } from '../../types/db.types';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  team_id: string | null;
  team_name?: string | null;
  user_id: string | null;
  user_name?: string | null;
  github_repo: string | null;
  status: ProjectStatus;
  mission_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  teamId?: string | null;
  userId?: string | null;
  githubRepo?: string | null;
}

export class ProjectRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  private mapRow(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      teamId: row.team_id,
      teamName: row.team_name,
      userId: row.user_id,
      userName: row.user_name,
      githubRepo: row.github_repo,
      status: row.status,
      missionCount: Number(row.mission_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  createProject(input: CreateProjectInput): Project {
    const db = this.getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO projects (
        id, name, description, team_id, user_id, github_repo, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);

    stmt.run(
      id,
      input.name.trim(),
      input.description?.trim() || null,
      input.teamId || null,
      input.userId || null,
      input.githubRepo?.trim() || null,
      now,
      now
    );

    const created = this.getProject(id);
    if (!created) {
      throw new Error('Failed to retrieve newly created project.');
    }
    return created;
  }

  getProject(id: string): Project | null {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT 
        p.*,
        t.name as team_name,
        u.name as user_name,
        (SELECT COUNT(*) FROM missions m WHERE m.project_id = p.id) as mission_count
      FROM projects p
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `);

    const row = stmt.get(id) as ProjectRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  listProjects(params: { userId?: string; teamId?: string | null }): Project[] {
    const db = this.getDb();

    if (params.teamId) {
      const stmt = db.prepare(`
        SELECT 
          p.*,
          t.name as team_name,
          u.name as user_name,
          (SELECT COUNT(*) FROM missions m WHERE m.project_id = p.id) as mission_count
        FROM projects p
        LEFT JOIN teams t ON p.team_id = t.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.team_id = ? AND p.status != 'archived'
        ORDER BY p.updated_at DESC
      `);
      const rows = stmt.all(params.teamId) as ProjectRow[];
      return rows.map((r) => this.mapRow(r));
    }

    if (params.userId) {
      const stmt = db.prepare(`
        SELECT 
          p.*,
          t.name as team_name,
          u.name as user_name,
          (SELECT COUNT(*) FROM missions m WHERE m.project_id = p.id) as mission_count
        FROM projects p
        LEFT JOIN teams t ON p.team_id = t.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE (
          (p.user_id = ? AND p.team_id IS NULL)
          OR p.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?)
        ) AND p.status != 'archived'
        ORDER BY p.updated_at DESC
      `);
      const rows = stmt.all(params.userId, params.userId) as ProjectRow[];
      return rows.map((r) => this.mapRow(r));
    }

    // Default guest list
    const stmt = db.prepare(`
      SELECT 
        p.*,
        t.name as team_name,
        u.name as user_name,
        (SELECT COUNT(*) FROM missions m WHERE m.project_id = p.id) as mission_count
      FROM projects p
      LEFT JOIN teams t ON p.team_id = t.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.user_id IS NULL AND p.team_id IS NULL AND p.status != 'archived'
      ORDER BY p.updated_at DESC
    `);
    const rows = stmt.all() as ProjectRow[];
    return rows.map((r) => this.mapRow(r));
  }

  updateProject(
    id: string,
    updates: { name?: string; description?: string | null; githubRepo?: string | null; status?: ProjectStatus }
  ): Project | null {
    const db = this.getDb();
    const existing = this.getProject(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const githubRepo = updates.githubRepo !== undefined ? updates.githubRepo : existing.githubRepo;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, github_repo = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(name, description, githubRepo, status, now, id);
    return this.getProject(id);
  }

  deleteProject(id: string): boolean {
    const db = this.getDb();
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

export const projectRepository = new ProjectRepository();
