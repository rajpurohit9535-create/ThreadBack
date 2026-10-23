import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { Team, TeamMember, TeamInvitation, TeamRole, InvitationStatus } from '../../types/db.types';
import { generateInviteToken } from '../../utils/auth';
import { ApiError } from '../../utils/api-error';

interface TeamRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role?: TeamRole;
  member_count?: number;
}

interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

interface TeamInvitationRow {
  id: string;
  team_id: string;
  team_name?: string;
  email: string | null;
  token: string;
  role: 'admin' | 'member';
  invited_by: string;
  inviter_name?: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

export class TeamRepository {
  constructor(private readonly getDb: () => Database.Database = getDatabase) {}

  /**
   * Creates a team and automatically assigns the creator as the 'owner' role.
   */
  createTeam(name: string, ownerUserId: string): { team: Team; membership: TeamMember } {
    const db = this.getDb();
    const teamId = randomUUID();
    const membershipId = randomUUID();
    const now = new Date().toISOString();

    const insertTeam = db.prepare<[string, string, string, string, string]>(`
      INSERT INTO teams (id, name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMembership = db.prepare<[string, string, string, string, string]>(`
      INSERT INTO team_memberships (id, team_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, 'owner', ?, ?)
    `);

    const userRow = db
      .prepare<[string], { name: string; email: string }>('SELECT name, email FROM users WHERE id = ?')
      .get(ownerUserId);

    const tx = db.transaction(() => {
      insertTeam.run(teamId, name.trim(), ownerUserId, now, now);
      insertMembership.run(membershipId, teamId, ownerUserId, now, now);
    });

    tx();

    return {
      team: {
        id: teamId,
        name: name.trim(),
        createdBy: ownerUserId,
        createdAt: now,
        updatedAt: now,
        role: 'owner',
        memberCount: 1,
      },
      membership: {
        id: membershipId,
        teamId,
        userId: ownerUserId,
        role: 'owner',
        userName: userRow?.name || 'Owner',
        userEmail: userRow?.email || '',
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  getTeamById(teamId: string): Team | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], TeamRow>(`
        SELECT t.*, COUNT(tm.user_id) as member_count
        FROM teams t
        LEFT JOIN team_memberships tm ON t.id = tm.team_id
        WHERE t.id = ?
        GROUP BY t.id
      `)
      .get(teamId);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: Number(row.member_count || 1),
    };
  }

  listUserTeams(userId: string): Team[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string], TeamRow>(`
        SELECT 
          t.id, 
          t.name, 
          t.created_by, 
          t.created_at, 
          t.updated_at, 
          tm.role,
          (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id) as member_count
        FROM teams t
        INNER JOIN team_memberships tm ON t.id = tm.team_id
        WHERE tm.user_id = ?
        ORDER BY t.created_at DESC
      `)
      .all(userId);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      role: r.role,
      memberCount: Number(r.member_count || 1),
    }));
  }

  getMembership(teamId: string, userId: string): TeamMember | null {
    const db = this.getDb();
    const row = db
      .prepare<[string, string], TeamMemberRow>(`
        SELECT 
          tm.id, 
          tm.team_id, 
          tm.user_id, 
          tm.role, 
          tm.created_at, 
          tm.updated_at,
          u.name as user_name, 
          u.email as user_email
        FROM team_memberships tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND tm.user_id = ?
      `)
      .get(teamId, userId);

    if (!row) return null;

    return {
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role,
      userName: row.user_name,
      userEmail: row.user_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listTeamMembers(teamId: string): TeamMember[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string], TeamMemberRow>(`
        SELECT 
          tm.id, 
          tm.team_id, 
          tm.user_id, 
          tm.role, 
          tm.created_at, 
          tm.updated_at,
          u.name as user_name, 
          u.email as user_email
        FROM team_memberships tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY 
          CASE tm.role 
            WHEN 'owner' THEN 1 
            WHEN 'admin' THEN 2 
            ELSE 3 
          END,
          tm.created_at ASC
      `)
      .all(teamId);

    return rows.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      userId: r.user_id,
      role: rowToRole(r.role),
      userName: r.user_name,
      userEmail: r.user_email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  addMember(teamId: string, userId: string, role: TeamRole = 'member'): TeamMember {
    const db = this.getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare<[string, string, string, string, string, string]>(`
      INSERT INTO team_memberships (id, team_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(team_id, user_id) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
    `).run(id, teamId, userId, role, now, now);

    return this.getMembership(teamId, userId)!;
  }

  updateMemberRole(teamId: string, userId: string, role: TeamRole): boolean {
    const db = this.getDb();
    const now = new Date().toISOString();
    const res = db
      .prepare<[string, string, string, string]>(`
        UPDATE team_memberships SET role = ?, updated_at = ? WHERE team_id = ? AND user_id = ?
      `)
      .run(role, now, teamId, userId);

    return res.changes > 0;
  }

  removeMember(teamId: string, userId: string): boolean {
    const db = this.getDb();
    const res = db
      .prepare<[string, string]>('DELETE FROM team_memberships WHERE team_id = ? AND user_id = ?')
      .run(teamId, userId);

    return res.changes > 0;
  }

  createInvitation(
    teamId: string,
    invitedBy: string,
    role: 'admin' | 'member' = 'member',
    email?: string,
    expiresInDays: number = 7
  ): TeamInvitation {
    const db = this.getDb();
    const id = randomUUID();
    const token = generateInviteToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const createdAt = now.toISOString();
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    db.prepare<[string, string, string | null, string, string, string, string, string]>(`
      INSERT INTO team_invitations (id, team_id, email, token, role, invited_by, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, teamId, normalizedEmail, token, role, invitedBy, expiresAt, createdAt);

    const team = this.getTeamById(teamId);
    const inviter = db
      .prepare<[string], { name: string }>('SELECT name FROM users WHERE id = ?')
      .get(invitedBy);

    return {
      id,
      teamId,
      teamName: team?.name,
      email: normalizedEmail,
      token,
      role,
      invitedBy,
      inviterName: inviter?.name,
      status: 'pending',
      expiresAt,
      createdAt,
    };
  }

  getInvitationByToken(token: string): TeamInvitation | null {
    const db = this.getDb();
    const row = db
      .prepare<[string], TeamInvitationRow>(`
        SELECT 
          ti.*, 
          t.name as team_name, 
          u.name as inviter_name
        FROM team_invitations ti
        JOIN teams t ON ti.team_id = t.id
        JOIN users u ON ti.invited_by = u.id
        WHERE ti.token = ?
      `)
      .get(token);

    if (!row) return null;

    // Check expiration
    const isExpired = new Date(row.expires_at).getTime() < Date.now();
    const status: InvitationStatus = isExpired && row.status === 'pending' ? 'expired' : row.status;

    return {
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      email: row.email,
      token: row.token,
      role: row.role,
      invitedBy: row.invited_by,
      inviterName: row.inviter_name,
      status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  listPendingInvitations(teamId: string): TeamInvitation[] {
    const db = this.getDb();
    const rows = db
      .prepare<[string], TeamInvitationRow>(`
        SELECT 
          ti.*, 
          t.name as team_name, 
          u.name as inviter_name
        FROM team_invitations ti
        JOIN teams t ON ti.team_id = t.id
        JOIN users u ON ti.invited_by = u.id
        WHERE ti.team_id = ? AND ti.status = 'pending' AND ti.expires_at > datetime('now')
        ORDER BY ti.created_at DESC
      `)
      .all(teamId);

    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      email: row.email,
      token: row.token,
      role: row.role,
      invitedBy: row.invited_by,
      inviterName: row.inviter_name,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  acceptInvitation(token: string, userId: string): { team: Team; membership: TeamMember } {
    const db = this.getDb();
    const invitation = this.getInvitationByToken(token);

    if (!invitation) {
      throw ApiError.notFound('Invalid or expired invitation token.');
    }

    if (invitation.status !== 'pending') {
      throw ApiError.badRequest(`This invitation has already been ${invitation.status}.`);
    }

    const team = this.getTeamById(invitation.teamId);
    if (!team) {
      throw ApiError.notFound('The team associated with this invitation no longer exists.');
    }

    const membershipId = randomUUID();
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      // 1. Mark invitation accepted
      db.prepare<[string]>("UPDATE team_invitations SET status = 'accepted' WHERE token = ?").run(token);

      // 2. Insert team membership
      db.prepare<[string, string, string, string, string, string]>(`
        INSERT INTO team_memberships (id, team_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(team_id, user_id) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
      `).run(membershipId, invitation.teamId, userId, invitation.role, now, now);
    });

    tx();

    const membership = this.getMembership(invitation.teamId, userId)!;
    return { team, membership };
  }

  revokeInvitation(invitationId: string, teamId: string): boolean {
    const db = this.getDb();
    const res = db
      .prepare<[string, string]>(`
        UPDATE team_invitations SET status = 'revoked' WHERE id = ? AND team_id = ?
      `)
      .run(invitationId, teamId);

    return res.changes > 0;
  }
}

function rowToRole(role: string): TeamRole {
  if (role === 'owner' || role === 'admin' || role === 'member') return role;
  return 'member';
}

export const teamRepository = new TeamRepository();
