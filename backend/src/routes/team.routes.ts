import { Router } from 'express';
import { TeamController } from '../controllers/team.controller';
import { requireAuth } from '../middleware/auth';

export const teamRouter = Router();

// Team management (all require authentication)
teamRouter.post('/', requireAuth, TeamController.createTeam);
teamRouter.get('/', requireAuth, TeamController.listTeams);
teamRouter.get('/:teamId', requireAuth, TeamController.getTeam);
teamRouter.post('/:teamId/invites', requireAuth, TeamController.createInvitation);
teamRouter.get('/:teamId/invites', requireAuth, TeamController.listInvitations);
teamRouter.delete('/:teamId/invites/:inviteId', requireAuth, TeamController.revokeInvitation);
teamRouter.post('/:teamId/leave', requireAuth, TeamController.leaveTeam);
teamRouter.delete('/:teamId/members/:userId', requireAuth, TeamController.removeMember);

// Separate router for invite resolution
export const inviteRouter = Router();
inviteRouter.get('/:token', TeamController.getPublicInvitation);
inviteRouter.post('/:token/accept', requireAuth, TeamController.acceptInvitation);
