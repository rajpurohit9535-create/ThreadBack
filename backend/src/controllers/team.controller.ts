import { Request, Response, NextFunction } from 'express';
import { createTeamSchema, inviteMemberSchema } from '../schemas/team.schema';
import { teamRepository } from '../db';
import { ApiError } from '../utils/api-error';

export class TeamController {
  /**
   * POST /api/teams
   * Creates a new team and sets the creator as owner.
   */
  static createTeam(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const validated = createTeamSchema.parse(req.body);
      const result = teamRepository.createTeam(validated.name, req.user.id);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/teams
   * Lists teams that the current user belongs to.
   */
  static listTeams(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teams = teamRepository.listUserTeams(req.user.id);
      res.status(200).json({ teams });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/teams/:teamId
   * Retrieves team details, members, and pending invites (if admin/owner).
   */
  static getTeam(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = String(req.params.teamId || '');
      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership) {
        throw ApiError.forbidden('You are not a member of this team.');
      }

      const team = teamRepository.getTeamById(teamId);
      if (!team) {
        throw ApiError.notFound(`Team ${teamId} not found.`);
      }

      const members = teamRepository.listTeamMembers(teamId);
      const canManage = membership.role === 'owner' || membership.role === 'admin';
      const pendingInvites = canManage ? teamRepository.listPendingInvitations(teamId) : [];

      res.status(200).json({
        team: {
          ...team,
          role: membership.role,
        },
        members,
        pendingInvites,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/teams/:teamId/invites
   * Creates an invitation (by email or link token).
   * Only owner or admin can invite.
   */
  static createInvitation(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = String(req.params.teamId || '');
      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ApiError.forbidden('Only team owners or admins can invite new members.');
      }

      const validated = inviteMemberSchema.parse(req.body);
      const invitation = teamRepository.createInvitation(
        teamId,
        req.user.id,
        validated.role,
        validated.email || undefined
      );

      res.status(201).json({
        invitation,
        inviteToken: invitation.token,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/teams/:teamId/invites
   * Lists pending invitations for a team (admin/owner only).
   */
  static listInvitations(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = String(req.params.teamId || '');
      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ApiError.forbidden('Only team owners or admins can view invitations.');
      }

      const invitations = teamRepository.listPendingInvitations(teamId);
      res.status(200).json({ invitations });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/teams/:teamId/invites/:inviteId
   * Revokes an invitation.
   */
  static revokeInvitation(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = String(req.params.teamId || '');
      const inviteId = String(req.params.inviteId || '');
      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw ApiError.forbidden('Only team owners or admins can revoke invitations.');
      }

      const success = teamRepository.revokeInvitation(inviteId, teamId);
      if (!success) {
        throw ApiError.notFound('Invitation not found or already revoked.');
      }

      res.status(200).json({ success: true, message: 'Invitation revoked.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invites/:token
   * Public info about an invitation token (so prospective members can see team details).
   */
  static getPublicInvitation(req: Request, res: Response, next: NextFunction): void {
    try {
      const token = String(req.params.token || '');
      const invitation = teamRepository.getInvitationByToken(token);

      if (!invitation) {
        throw ApiError.notFound('Invitation not found.');
      }

      res.status(200).json({ invitation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/invites/:token/accept
   * Accepts an invitation and adds the authenticated user to the team.
   */
  static acceptInvitation(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required to accept an invitation.');
      }

      const token = String(req.params.token || '');
      const result = teamRepository.acceptInvitation(token, req.user.id);

      res.status(200).json({
        message: 'Successfully joined team.',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/teams/:teamId/leave
   * Current user leaves the team.
   */
  static leaveTeam(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = String(req.params.teamId || '');
      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership) {
        throw ApiError.notFound('You are not a member of this team.');
      }

      if (membership.role === 'owner') {
        const allMembers = teamRepository.listTeamMembers(teamId);
        const otherOwners = allMembers.filter((m) => m.role === 'owner' && m.userId !== req.user!.id);
        if (otherOwners.length === 0 && allMembers.length > 1) {
          throw ApiError.badRequest('You must assign another owner before leaving the team.');
        }
      }

      teamRepository.removeMember(teamId, req.user.id);
      res.status(200).json({ success: true, message: 'You have left the team.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/teams/:teamId/members/:userId
   * Removes a member from the team (owner/admin or member leaving).
   */
  static removeMember(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const teamId = String(req.params.teamId || '');
      const userId = String(req.params.userId || '');
      const currentMembership = teamRepository.getMembership(teamId, req.user.id);
      if (!currentMembership) {
        throw ApiError.forbidden('You are not a member of this team.');
      }

      const isSelf = req.user.id === userId;
      if (!isSelf && currentMembership.role !== 'owner' && currentMembership.role !== 'admin') {
        throw ApiError.forbidden('Only team owners or admins can remove other members.');
      }

      const targetMembership = teamRepository.getMembership(teamId, userId);
      if (!targetMembership) {
        throw ApiError.notFound('Member not found in this team.');
      }

      if (targetMembership.role === 'owner' && currentMembership.role !== 'owner') {
        throw ApiError.forbidden('Only owners can remove other owners.');
      }

      teamRepository.removeMember(teamId, userId);
      res.status(200).json({ success: true, message: 'Member removed.' });
    } catch (error) {
      next(error);
    }
  }
}
