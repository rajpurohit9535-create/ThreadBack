import { z } from 'zod';

export const createMissionSchema = z.object({
  objective: z
    .string({ message: 'Mission objective is required' })
    .trim()
    .min(1, { message: 'Mission objective cannot be empty' })
    .max(4000, { message: 'Mission objective cannot exceed 4000 characters' }),
  projectId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  visibility: z.enum(['personal', 'team']).optional(),
});

export const createSideQuestSchema = z.object({
  topic: z
    .string({ message: 'SideQuest topic is required' })
    .trim()
    .min(1, { message: 'SideQuest topic cannot be empty' })
    .max(500, { message: 'SideQuest topic cannot exceed 500 characters' }),
  isShared: z.boolean().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid ID format; must be a valid UUID' }),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type CreateSideQuestInput = z.infer<typeof createSideQuestSchema>;
export type IdParamInput = z.infer<typeof idParamSchema>;
