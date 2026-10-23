import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z
    .string({ message: 'Team name is required' })
    .trim()
    .min(1, { message: 'Team name cannot be empty' })
    .max(100, { message: 'Team name cannot exceed 100 characters' }),
});

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Invalid email address' })
    .optional()
    .or(z.literal('')),
  role: z.enum(['admin', 'member']).default('member'),
});

export const createDecisionSchema = z.object({
  decision: z
    .string({ message: 'Decision text is required' })
    .trim()
    .min(1, { message: 'Decision text cannot be empty' })
    .max(2000, { message: 'Decision text cannot exceed 2000 characters' }),
  category: z
    .enum(['decision', 'learning', 'blocker', 'next_step'])
    .default('decision'),
  sourceConversationId: z.string().uuid().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
