import { Request, Response, NextFunction } from 'express';
import {
  createMissionSchema,
  createSideQuestSchema,
  idParamSchema,
} from '../schemas/mission.schema';
import { createDecisionSchema } from '../schemas/team.schema';
import {
  missionRepository,
  conversationRepository,
  messageRepository,
  teamRepository,
  decisionRepository,
} from '../db';
import { returnToMissionService } from '../services/return-to-mission.service';
import { ApiError } from '../utils/api-error';

export class MissionController {
  /**
   * Helper to verify if the requesting user has access to a mission.
   * Throws 401/403 if unauthorized.
   */
  private static checkMissionAccess(req: Request, missionId: string) {
    const mission = missionRepository.getMissionById(missionId);
    if (!mission) {
      throw ApiError.notFound(`Mission with ID ${missionId} not found.`);
    }

    if (mission.teamId) {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required to access team missions.');
      }
      const membership = teamRepository.getMembership(mission.teamId, req.user.id);
      if (!membership) {
        throw ApiError.forbidden('You are not a member of the team that owns this mission.');
      }
      return { mission, membership };
    }

    // Personal mission checks
    if (mission.userId && req.user && mission.userId !== req.user.id) {
      throw ApiError.forbidden('You do not have permission to access this personal mission.');
    }

    return { mission, membership: null };
  }

  /**
   * POST /api/missions
   * Creates a new mission and its initial main conversation atomically.
   */
  static createMission(req: Request, res: Response, next: NextFunction): void {
    try {
      const validatedBody = createMissionSchema.parse(req.body);

      let teamId: string | null = null;
      let visibility: 'personal' | 'team' = 'personal';

      if (validatedBody.teamId) {
        if (!req.user) {
          throw ApiError.unauthorized('Authentication required to create a team mission.');
        }

        const membership = teamRepository.getMembership(validatedBody.teamId, req.user.id);
        if (!membership) {
          throw ApiError.forbidden('You are not a member of this team.');
        }

        teamId = validatedBody.teamId;
        visibility = 'team';
      }

      const result = missionRepository.createMissionWithMainConversation(validatedBody.objective, {
        projectId: validatedBody.projectId || null,
        teamId,
        userId: req.user?.id || null,
        visibility,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/missions/:id
   * Retrieves a mission, accessible conversations (main and sidequests), and approved decisions.
   */
  static getMission(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = idParamSchema.parse(req.params);
      MissionController.checkMissionAccess(req, id);

      const result = missionRepository.getMissionWithConversations(id, req.user?.id || null);
      if (!result) {
        throw ApiError.notFound(`Mission with ID ${id} not found.`);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/missions
   * Lists missions scoped by project, team or user.
   */
  static listMissions(req: Request, res: Response, next: NextFunction): void {
    try {
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId.trim() : null;
      if (projectId) {
        const missions = missionRepository.listMissions({ projectId });
        res.status(200).json({ missions });
        return;
      }

      const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : null;

      if (teamId) {
        if (!req.user) {
          throw ApiError.unauthorized('Authentication required to view team missions.');
        }

        const membership = teamRepository.getMembership(teamId, req.user.id);
        if (!membership) {
          throw ApiError.forbidden('You are not a member of this team.');
        }

        const missions = missionRepository.listMissions({ teamId });
        res.status(200).json({ missions });
        return;
      }

      // Personal / general missions
      const missions = missionRepository.listMissions({
        userId: req.user?.id || null,
      });
      res.status(200).json({ missions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/missions/:id/sidequests
   * Creates a new SideQuest conversation linked to an existing mission.
   */
  static createSideQuest(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id: missionId } = idParamSchema.parse(req.params);
      MissionController.checkMissionAccess(req, missionId);

      const validatedBody = createSideQuestSchema.parse(req.body);
      const sideQuest = conversationRepository.createSideQuestConversation(
        missionId,
        validatedBody.topic,
        {
          userId: req.user?.id || null,
          isShared: validatedBody.isShared !== undefined ? validatedBody.isShared : true,
        }
      );

      res.status(201).json({ sideQuest });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/conversations/:id/messages
   * Retrieves messages for a conversation in chronological order.
   */
  static getConversationMessages(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id: conversationId } = idParamSchema.parse(req.params);
      const conversation = conversationRepository.getConversationById(conversationId);

      if (!conversation) {
        throw ApiError.notFound(`Conversation with ID ${conversationId} not found.`);
      }

      // Check mission access
      MissionController.checkMissionAccess(req, conversation.missionId);

      // If conversation is a private sidequest, ensure current user is the owner
      if (conversation.type === 'sidequest' && !conversation.isShared) {
        if (!req.user || (conversation.userId && conversation.userId !== req.user.id)) {
          throw ApiError.forbidden('This SideQuest conversation is private to another teammate.');
        }
      }

      const messages = messageRepository.getMessagesByConversationId(conversationId);
      res.status(200).json({
        conversationId,
        type: conversation.type,
        topic: conversation.topic,
        isShared: conversation.isShared,
        userId: conversation.userId,
        messages,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/:id/share
   * Toggles visibility of a SideQuest conversation (sharing with teammates).
   */
  static toggleShareConversation(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id: conversationId } = idParamSchema.parse(req.params);
      const conversation = conversationRepository.getConversationById(conversationId);

      if (!conversation) {
        throw ApiError.notFound(`Conversation with ID ${conversationId} not found.`);
      }

      MissionController.checkMissionAccess(req, conversation.missionId);

      if (req.user && conversation.userId && conversation.userId !== req.user.id) {
        throw ApiError.forbidden('Only the creator can toggle sharing for this SideQuest.');
      }

      const isShared = req.body.isShared === undefined ? true : Boolean(req.body.isShared);
      conversationRepository.toggleShareConversation(conversationId, isShared);

      res.status(200).json({
        success: true,
        conversationId,
        isShared,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/missions/:id/decisions
   * Returns approved shared decisions with contributor attribution and timestamps.
   */
  static listDecisions(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id: missionId } = idParamSchema.parse(req.params);
      MissionController.checkMissionAccess(req, missionId);

      const decisions = decisionRepository.listMissionDecisions(missionId);
      res.status(200).json({ decisions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/missions/:id/decisions
   * Approves a decision into shared team memory with contributor tracking.
   */
  static addDecision(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id: missionId } = idParamSchema.parse(req.params);
      MissionController.checkMissionAccess(req, missionId);

      const validated = createDecisionSchema.parse(req.body);
      const contributedBy = req.user?.id || 'anonymous';
      const contributorName = req.user?.name || 'Anonymous Contributor';

      const decision = decisionRepository.addDecision(
        missionId,
        validated.decision,
        validated.category,
        contributedBy,
        contributorName,
        validated.sourceConversationId
      );

      res.status(201).json({ decision });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/missions/:id/decisions/:decisionId
   * Removes an approved decision.
   */
  static deleteDecision(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id: missionId } = idParamSchema.parse(req.params);
      const decisionId = String(req.params.decisionId || '');
      MissionController.checkMissionAccess(req, missionId);

      const success = decisionRepository.deleteDecision(decisionId, missionId);
      if (!success) {
        throw ApiError.notFound('Decision not found.');
      }

      res.status(200).json({ success: true, message: 'Decision removed.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/:id/return-to-mission
   */
  static async returnToMission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: conversationId } = idParamSchema.parse(req.params);
      const conversation = conversationRepository.getConversationById(conversationId);

      if (!conversation) {
        throw ApiError.notFound(`Conversation with ID ${conversationId} not found.`);
      }

      MissionController.checkMissionAccess(req, conversation.missionId);

      const result = await returnToMissionService.returnToMission(conversationId);

      // Record approved findings in shared_decisions with contributor info
      if (result.summary && Array.isArray(result.summary.decisions)) {
        const contributedBy = req.user?.id || 'anonymous';
        const contributorName = req.user?.name || 'Teammate';
        for (const dec of result.summary.decisions) {
          decisionRepository.addDecision(
            conversation.missionId,
            dec,
            'decision',
            contributedBy,
            contributorName,
            conversationId
          );
        }
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/missions/:id/claim
   * Claims an unowned legacy mission for the authenticated user.
   */
  static claimMission(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required to claim a mission.');
      }

      const { id } = idParamSchema.parse(req.params);
      const mission = missionRepository.getMissionById(id);
      if (!mission) {
        throw ApiError.notFound('Mission not found.');
      }

      if (mission.userId && mission.userId !== req.user.id) {
        throw ApiError.forbidden('This mission already belongs to another user.');
      }

      const success = missionRepository.claimMission(id, req.user.id);
      res.status(200).json({ success, message: 'Mission claimed successfully.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/missions/:id/share-with-team
   * Promotes a personal mission to a shared team mission.
   */
  static shareWithTeam(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required.');
      }

      const { id } = idParamSchema.parse(req.params);
      const mission = missionRepository.getMissionById(id);
      if (!mission) {
        throw ApiError.notFound('Mission not found.');
      }

      if (mission.userId && mission.userId !== req.user.id) {
        throw ApiError.forbidden('Only the owner can share this mission with a team.');
      }

      const teamId = String(req.body.teamId || '');
      if (!teamId) {
        throw ApiError.badRequest('teamId is required.');
      }

      const membership = teamRepository.getMembership(teamId, req.user.id);
      if (!membership) {
        throw ApiError.forbidden('You are not a member of the target team.');
      }

      const success = missionRepository.shareMissionWithTeam(id, teamId, req.user.id);
      res.status(200).json({ success, message: 'Mission is now shared with team.' });
    } catch (error) {
      next(error);
    }
  }
}
