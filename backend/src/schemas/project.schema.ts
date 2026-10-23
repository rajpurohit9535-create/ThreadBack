import { z } from 'zod';

export function validateAndNormalizeGitHubRepo(input: string | null | undefined): {
  isValid: boolean;
  normalizedUrl?: string;
  fullName?: string;
  canonical?: string;
  error?: string;
} {
  if (!input || !input.trim()) {
    return { isValid: true };
  }

  const trimmed = input.trim();
  let cleaned = trimmed.replace(/\.git$/i, '');
  cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');

  const parts = cleaned.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      isValid: false,
      error: 'Invalid GitHub repository format. Expected: https://github.com/owner/repository or owner/repository',
    };
  }

  const [owner, repo] = parts;
  const validOwnerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  const validRepoRegex = /^[a-zA-Z0-9_.-]+$/;

  if (!validOwnerRegex.test(owner) || !validRepoRegex.test(repo)) {
    return {
      isValid: false,
      error: 'Repository URL contains invalid characters. Expected alphanumeric names with hyphens/underscores.',
    };
  }

  const fullName = `${owner}/${repo}`;
  const normalizedUrl = `https://github.com/${fullName}`;
  const isUrl = /^(?:https?:\/\/|(?:www\.)?github\.com)/i.test(trimmed);

  return {
    isValid: true,
    normalizedUrl,
    fullName,
    canonical: isUrl ? normalizedUrl : fullName,
  };
}

export const createProjectSchema = z.object({
  name: z
    .string({ message: 'Project name is required' })
    .trim()
    .min(1, { message: 'Project name cannot be empty' })
    .max(100, { message: 'Project name cannot exceed 100 characters' }),
  description: z
    .string()
    .trim()
    .max(1000, { message: 'Description cannot exceed 1000 characters' })
    .optional()
    .nullable(),
  teamId: z.string().uuid({ message: 'Invalid team ID format' }).optional().nullable(),
  githubRepo: z
    .string()
    .trim()
    .max(300, { message: 'GitHub repo cannot exceed 300 characters' })
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return validateAndNormalizeGitHubRepo(val).isValid;
    }, {
      message: 'Invalid GitHub repository URL. Expected format: https://github.com/owner/repository or owner/repository',
    }),
  invitations: z
    .array(
      z.object({
        email: z.string().email({ message: 'Invalid email address' }),
        role: z.enum(['admin', 'member']).default('member'),
      })
    )
    .optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  githubRepo: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return validateAndNormalizeGitHubRepo(val).isValid;
    }, {
      message: 'Invalid GitHub repository URL. Expected format: https://github.com/owner/repository or owner/repository',
    }),
  status: z.enum(['active', 'archived']).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
