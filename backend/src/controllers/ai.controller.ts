import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { chatRequestSchema } from '../schemas/chat.schema';
import { sideQuestRequestSchema } from '../schemas/sidequest.schema';
import { mainAiService } from '../services/main-ai.service';
import { sideQuestService } from '../services/sidequest.service';
import { AiStatusResponse, HealthResponse } from '../types/ai.types';
import { conversationRepository, missionRepository, teamRepository } from '../db';
import { ApiError } from '../utils/api-error';

export class AiController {
  private static checkConversationAccess(req: Request, conversationId?: string) {
    if (!conversationId) return;
    const conv = conversationRepository.getConversationById(conversationId);
    if (!conv) return;

    const mission = missionRepository.getMissionById(conv.missionId);
    if (!mission) return;

    if (mission.teamId) {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required to chat in a team mission.');
      }
      const membership = teamRepository.getMembership(mission.teamId, req.user.id);
      if (!membership) {
        throw ApiError.forbidden('You are not a member of the team that owns this mission.');
      }
    } else if (mission.userId && req.user && mission.userId !== req.user.id) {
      throw ApiError.forbidden('You do not have access to this personal mission.');
    }
  }

  /**
   * POST /api/ai/chat
   */
  static async handleChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedPayload = chatRequestSchema.parse(req.body);
      AiController.checkConversationAccess(req, validatedPayload.conversationId);

      const userContext = req.user ? { id: req.user.id, name: req.user.name } : undefined;
      const result = await mainAiService.processChat(validatedPayload, userContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ai/sidequest/chat
   */
  static async handleSidequestChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedPayload = sideQuestRequestSchema.parse(req.body);
      AiController.checkConversationAccess(req, validatedPayload.conversationId);

      const userContext = req.user ? { id: req.user.id, name: req.user.name } : undefined;
      const result = await sideQuestService.processSideQuestChat(validatedPayload, userContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ai/status
   */
  static handleStatus(_req: Request, res: Response): void {
    const statusResponse: AiStatusResponse = {
      configured: env.isAiConfigured,
      model: env.gemmaModel,
    };
    res.status(200).json(statusResponse);
  }

  /**
   * GET /api/health
   */
  static handleHealth(_req: Request, res: Response): void {
    const healthResponse: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(healthResponse);
  }
}
