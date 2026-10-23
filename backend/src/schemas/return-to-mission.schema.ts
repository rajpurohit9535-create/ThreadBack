import { z } from 'zod';

export const sideQuestLearningSummarySchema = z.object({
  topic: z
    .string({ message: 'Topic is required' })
    .trim()
    .min(1, { message: 'Topic cannot be empty' })
    .max(500, { message: 'Topic cannot exceed 500 characters' }),
  keyLearnings: z
    .array(z.string().trim().min(1, { message: 'Learning item cannot be empty' }))
    .min(1, { message: 'At least one key learning or insufficient-history notice is required' }),
  decisions: z
    .array(z.string().trim().min(1, { message: 'Decision item cannot be empty' }))
    .default([]),
  usefulExamples: z
    .array(z.string().trim().min(1, { message: 'Example item cannot be empty' }))
    .default([]),
  unresolvedQuestions: z
    .array(z.string().trim().min(1, { message: 'Question item cannot be empty' }))
    .default([]),
  missionRelevance: z
    .string({ message: 'Mission relevance is required' })
    .trim()
    .min(1, { message: 'Mission relevance cannot be empty' })
    .max(3000, { message: 'Mission relevance cannot exceed 3000 characters' }),
});

export type SideQuestLearningSummary = z.infer<typeof sideQuestLearningSummarySchema>;
