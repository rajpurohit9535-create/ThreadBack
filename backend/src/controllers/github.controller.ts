import { Request, Response, NextFunction } from 'express';
import { githubService } from '../services/github.service';
import { connectGitHubSchema, createFeedbackSchema } from '../schemas/github.schema';
import { githubRepository } from '../db/repositories/github.repo';
import { projectRepository } from '../db/repositories/project.repo';
import { validateAndNormalizeGitHubRepo } from '../schemas/project.schema';
import { repoAnalysisService } from '../services/repo-analysis.service';
import { driftDetectionService } from '../services/drift-detection.service';
import { feedbackRepository } from '../db/repositories/feedback.repo';
import { missionRepository } from '../db/repositories/mission.repo';
import { decisionRepository } from '../db/repositories/decision.repo';
import { ApiError } from '../utils/api-error';

export const githubController = {
  connect(req: Request, res: Response, next: NextFunction): void {
    try {
      const parsed = connectGitHubSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const connection = githubService.connect(req.user!.id, parsed.data);
      res.status(200).json({ connection });
    } catch (err) {
      next(err);
    }
  },

  getStatus(req: Request, res: Response, next: NextFunction): void {
    try {
      const status = githubService.getConnectionStatus(req.user!.id);
      res.status(200).json(status);
    } catch (err) {
      next(err);
    }
  },

  async getRepositories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const repositories = await githubService.getAuthorizedRepositories(req.user!.id);
      res.status(200).json({ repositories });
    } catch (err) {
      next(err);
    }
  },

  disconnect(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = githubService.disconnect(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  triggerRevocation(req: Request, res: Response, next: NextFunction): void {
    try {
      githubService.markRevoked(req.user!.id);
      res.status(200).json({ success: true, message: 'Simulated revocation applied' });
    } catch (err) {
      next(err);
    }
  },

  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let repo = req.body.repo || req.query.repo;
      const projectId = req.body.projectId || req.query.projectId;

      // If projectId is provided and repo is omitted, use the project's saved githubRepo
      if (projectId && typeof projectId === 'string') {
        const project = projectRepository.getProject(projectId);
        if (!project) {
          throw ApiError.notFound(`Project with ID ${projectId} not found.`);
        }
        if (!repo && project.githubRepo) {
          repo = project.githubRepo;
        }
      }

      if (!repo || typeof repo !== 'string' || !repo.trim()) {
        res.status(400).json({
          error: 'Repository URL is required. Provide "repo" in request or associate a repository URL with the project.',
        });
        return;
      }

      const validation = validateAndNormalizeGitHubRepo(repo);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.error || 'Invalid GitHub repository format.' });
        return;
      }

      let token: string | null = null;
      if (req.user) {
        token = githubRepository.getDecryptedAccessToken(req.user.id);
      }

      const report = await repoAnalysisService.analyzeRepository(validation.normalizedUrl || repo, token);
      res.status(200).json({ report });
    } catch (err) {
      next(err);
    }
  },

  async driftAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let repo = req.body.repo || req.query.repo;
      const projectId = req.body.projectId || req.query.projectId;

      if (projectId && typeof projectId === 'string') {
        const project = projectRepository.getProject(projectId);
        if (!project) {
          throw ApiError.notFound(`Project with ID ${projectId} not found.`);
        }
        if (!repo && project.githubRepo) {
          repo = project.githubRepo;
        }
      }

      if (!repo || typeof repo !== 'string' || !repo.trim()) {
        res.status(400).json({
          error: 'Repository URL is required. Provide "repo" in request or associate a repository URL with the project.',
        });
        return;
      }

      const validation = validateAndNormalizeGitHubRepo(repo);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.error || 'Invalid GitHub repository format.' });
        return;
      }

      let token: string | null = null;
      if (req.user) {
        token = githubRepository.getDecryptedAccessToken(req.user.id);
      }

      let customContext = req.body.context;
      if (!customContext && projectId) {
        const missions = missionRepository.listMissions({ projectId });
        const allDecisions = missions.flatMap((m) => decisionRepository.listMissionDecisions(m.id));
        if (allDecisions.length > 0) {
          const projectObj = projectRepository.getProject(projectId);
          customContext = {
            contextId: `TB-PROJECT-${projectId}`,
            contextName: projectObj?.name || 'Project Decisions Context',
            projectMission: missions.map((m) => m.objective).join('; ') || 'Project Objectives',
            version: '1.0.0',
            approvedDecisions: allDecisions.map((d) => ({
              id: d.id,
              title: d.decision,
              category: d.category === 'decision' ? 'architecture' : 'governance',
              status: 'Approved',
              rationale: `Approved decision recorded by ${d.contributorName}`,
              constraints: [d.decision],
              expectedArtifacts: [],
            })),
          };
        }
      }

      const driftReport = await driftDetectionService.evaluateRepositoryDrift(
        validation.normalizedUrl || repo,
        customContext,
        token
      );
      res.status(200).json({ driftReport });
    } catch (err) {
      next(err);
    }
  },

  createFeedback(req: Request, res: Response, next: NextFunction): void {
    try {
      const parsed = createFeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const feedback = feedbackRepository.createFeedback({
        projectId: parsed.data.projectId,
        userId: req.user?.id || null,
        userName: req.user?.name || 'Anonymous',
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      });

      res.status(201).json({ feedback });
    } catch (err) {
      next(err);
    }
  },

  listFeedback(req: Request, res: Response, next: NextFunction): void {
    try {
      const { projectId, targetType, targetId } = req.query;
      if (projectId && typeof projectId === 'string') {
        const items = feedbackRepository.listFeedbackByProject(projectId);
        res.status(200).json({ feedback: items });
        return;
      }
      if (targetType && targetId && typeof targetType === 'string' && typeof targetId === 'string') {
        const items = feedbackRepository.listFeedbackByTarget(targetType, targetId);
        res.status(200).json({ feedback: items });
        return;
      }
      res.status(400).json({ error: 'Either projectId or targetType & targetId query parameter is required' });
    } catch (err) {
      next(err);
    }
  },
};
