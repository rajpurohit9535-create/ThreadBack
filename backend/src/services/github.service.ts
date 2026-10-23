import { githubRepository, sanitizeGitHubConnection } from '../db/repositories/github.repo';
import { ConnectGitHubInput } from '../schemas/github.schema';
import { SanitizedGitHubConnection, GitHubRepo } from '../types/db.types';
import { ApiError } from '../utils/api-error';

export const githubService = {
  connect(userId: string, input: ConnectGitHubInput): SanitizedGitHubConnection {
    return githubRepository.saveConnection({
      userId,
      accountId: input.accountId,
      accountLogin: input.accountLogin,
      accountType: input.accountType || 'user',
      accessToken: input.accessToken,
      scope: input.scope || 'repo,read:user',
      tokenType: input.tokenType || 'bearer',
    });
  },

  getConnectionStatus(userId: string): { connected: boolean; connection: SanitizedGitHubConnection | null } {
    const raw = githubRepository.getConnectionByUserId(userId);
    if (!raw || raw.status === 'disconnected') {
      return { connected: false, connection: null };
    }

    return {
      connected: raw.status === 'active',
      connection: sanitizeGitHubConnection(raw),
    };
  },

  async getAuthorizedRepositories(userId: string): Promise<GitHubRepo[]> {
    const raw = githubRepository.getConnectionByUserId(userId);
    if (!raw || raw.status === 'disconnected') {
      throw new ApiError(400, 'GitHub is not connected. Please connect a GitHub account first.');
    }

    if (raw.status === 'revoked') {
      throw new ApiError(403, 'GitHub access was revoked. Please reconnect your GitHub account.');
    }

    const token = githubRepository.getDecryptedAccessToken(userId);
    if (!token) {
      githubRepository.markRevoked(userId);
      throw new ApiError(403, 'Unable to decrypt stored credentials or access revoked. Please reconnect.');
    }

    // Support mock/test environments or mock tokens
    if (token.startsWith('mock_') || token.startsWith('test_') || process.env.NODE_ENV === 'test') {
      return [
        {
          id: 'repo_101',
          name: 'threadback-core',
          fullName: `${raw.accountLogin}/threadback-core`,
          htmlUrl: `https://github.com/${raw.accountLogin}/threadback-core`,
          description: 'Core ThreadBack context engine and canvas',
          isPrivate: false,
          defaultBranch: 'main',
        },
        {
          id: 'repo_102',
          name: 'microservice-auth',
          fullName: `${raw.accountLogin}/microservice-auth`,
          htmlUrl: `https://github.com/${raw.accountLogin}/microservice-auth`,
          description: 'Production OAuth & JWT service',
          isPrivate: true,
          defaultBranch: 'main',
        },
        {
          id: 'repo_103',
          name: 'cloud-infra',
          fullName: `${raw.accountLogin}/cloud-infra`,
          htmlUrl: `https://github.com/${raw.accountLogin}/cloud-infra`,
          description: 'Terraform and Kubernetes deployment manifests',
          isPrivate: true,
          defaultBranch: 'master',
        },
      ];
    }

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'ThreadBack-App',
        },
      });

      if (response.status === 401 || response.status === 403) {
        githubRepository.markRevoked(userId);
        throw new ApiError(403, 'GitHub access token is invalid or revoked by GitHub');
      }

      if (!response.ok) {
        throw new ApiError(response.status, `GitHub API returned ${response.statusText}`);
      }

      const repos = (await response.json()) as any[];
      return repos.map((r) => ({
        id: String(r.id),
        name: r.name,
        fullName: r.full_name,
        htmlUrl: r.html_url,
        description: r.description || null,
        isPrivate: Boolean(r.private),
        defaultBranch: r.default_branch || 'main',
      }));
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to reach GitHub API: ${err.message}`);
    }
  },

  disconnect(userId: string): { success: boolean; message: string } {
    const success = githubRepository.disconnect(userId);
    return {
      success,
      message: success ? 'GitHub disconnected successfully' : 'No active GitHub connection found',
    };
  },

  markRevoked(userId: string): boolean {
    return githubRepository.markRevoked(userId);
  },
};
