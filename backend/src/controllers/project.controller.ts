import { Request, Response, NextFunction } from 'express';
import { createProjectSchema, updateProjectSchema, validateAndNormalizeGitHubRepo } from '../schemas/project.schema';
import { projectRepository } from '../db/repositories/project.repo';
import { teamRepository } from '../db/repositories/team.repo';
import { ApiError } from '../utils/api-error';

export class ProjectController {
  /**
   * Helper to verify if the requesting user has permission to access a project.
   */
  private static checkProjectAccess(req: Request, projectId: string) {
    const project = projectRepository.getProject(projectId);
    if (!project) {
      throw ApiError.notFound(`Project with ID ${projectId} not found.`);
    }

    if (project.teamId) {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required to access team projects.');
      }
      const membership = teamRepository.getMembership(project.teamId, req.user.id);
      if (!membership) {
        throw ApiError.forbidden('You are not a member of the team that owns this project.');
      }
      return { project, membership };
    }

    if (project.userId && req.user && project.userId !== req.user.id) {
      throw ApiError.forbidden('You do not have permission to access this personal project.');
    }

    return { project, membership: null };
  }

  /**
   * POST /api/projects
   * Creates a new project and handles optional initial invitations.
   */
  static createProject(req: Request, res: Response, next: NextFunction): void {
    try {
      const validated = createProjectSchema.parse(req.body);

      let teamId = validated.teamId || null;

      if (teamId) {
        if (!req.user) {
          throw ApiError.unauthorized('Authentication required to associate project with a team.');
        }
        const membership = teamRepository.getMembership(teamId, req.user.id);
        if (!membership) {
          throw ApiError.forbidden('You are not a member of the selected team.');
        }
      }

      let normalizedGithubRepo: string | null = null;
      if (validated.githubRepo && validated.githubRepo.trim()) {
        const norm = validateAndNormalizeGitHubRepo(validated.githubRepo);
        normalizedGithubRepo = norm.canonical || validated.githubRepo.trim();
      }

      const project = projectRepository.createProject({
        name: validated.name,
        description: validated.description,
        teamId,
        userId: req.user?.id || null,
        githubRepo: normalizedGithubRepo,
      });

      // Handle invitations if team is selected and invitations are provided
      const createdInvitations: Array<{ email: string; token: string; role: string }> = [];
      if (teamId && req.user && validated.invitations && validated.invitations.length > 0) {
        for (const inv of validated.invitations) {
          try {
            const invitation = teamRepository.createInvitation(
              teamId,
              req.user.id,
              inv.role,
              inv.email
            );
            createdInvitations.push({
              email: inv.email,
              token: invitation.token,
              role: invitation.role,
            });
          } catch {
            // Skip invalid individual invites without failing project creation
          }
        }
      }

      res.status(201).json({
        project,
        invitations: createdInvitations,
        message: 'Project created successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/projects
   * Lists projects for current user and their teams.
   */
  static listProjects(req: Request, res: Response, next: NextFunction): void {
    try {
      const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : null;

      if (teamId) {
        if (!req.user) {
          throw ApiError.unauthorized('Authentication required to view team projects.');
        }
        const membership = teamRepository.getMembership(teamId, req.user.id);
        if (!membership) {
          throw ApiError.forbidden('You are not a member of this team.');
        }
        const projects = projectRepository.listProjects({ teamId });
        res.status(200).json({ projects });
        return;
      }

      const projects = projectRepository.listProjects({
        userId: req.user?.id || undefined,
      });

      res.status(200).json({ projects });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/projects/:id
   */
  static getProject(req: Request, res: Response, next: NextFunction): void {
    try {
      const projectId = String(req.params.id || '');
      const { project } = ProjectController.checkProjectAccess(req, projectId);
      res.status(200).json({ project });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/projects/:id
   */
  static updateProject(req: Request, res: Response, next: NextFunction): void {
    try {
      const projectId = String(req.params.id || '');
      const { project, membership } = ProjectController.checkProjectAccess(req, projectId);

      if (project.teamId && membership && membership.role === 'member') {
        throw ApiError.forbidden('Only team owners or admins can update project details.');
      }

      const validated = updateProjectSchema.parse(req.body);
      const updateData = { ...validated };
      if (validated.githubRepo !== undefined) {
        if (validated.githubRepo && validated.githubRepo.trim()) {
          const norm = validateAndNormalizeGitHubRepo(validated.githubRepo);
          updateData.githubRepo = norm.canonical || validated.githubRepo.trim();
        } else {
          updateData.githubRepo = null;
        }
      }
      const updated = projectRepository.updateProject(projectId, updateData);

      res.status(200).json({ project: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/projects/:id
   */
  static deleteProject(req: Request, res: Response, next: NextFunction): void {
    try {
      const projectId = String(req.params.id || '');
      const { project, membership } = ProjectController.checkProjectAccess(req, projectId);

      if (project.teamId && membership && membership.role !== 'owner') {
        throw ApiError.forbidden('Only team owners can delete a project.');
      }

      projectRepository.deleteProject(projectId);
      res.status(200).json({ success: true, message: 'Project deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/projects/github/status
   * Honest configuration status of GitHub OAuth/App integration.
   */
  static getGitHubStatus(_req: Request, res: Response): void {
    const clientId = process.env.GITHUB_CLIENT_ID || null;
    const isConfigured = Boolean(clientId && process.env.GITHUB_CLIENT_SECRET);

    res.status(200).json({
      configured: isConfigured,
      clientId: isConfigured ? clientId : null,
      status: isConfigured ? 'ready' : 'unconfigured',
      message: isConfigured
        ? 'GitHub integration is configured.'
        : 'GitHub integration requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env. Phase 2 planned.',
      repositories: [],
    });
  }
}
