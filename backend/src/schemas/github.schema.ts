import { z } from 'zod';

export const connectGitHubSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  accountLogin: z.string().min(1, 'Account login is required'),
  accountType: z.enum(['user', 'app_installation']).optional().default('user'),
  scope: z.string().optional().nullable(),
  tokenType: z.string().optional().default('bearer'),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'OAuth code is required'),
  state: z.string().optional(),
});

export const createFeedbackSchema = z.object({
  projectId: z.string().optional().nullable(),
  targetType: z.enum(['repo_analysis', 'mission', 'sidequest']),
  targetId: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  comment: z.string().min(1, 'Comment is required').max(2000),
});

export type ConnectGitHubInput = z.infer<typeof connectGitHubSchema>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
