import { z } from 'zod';

export const chatRoleSchema = z.enum(['user', 'assistant'] as const);

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z
    .string({ message: 'Message content is required' })
    .trim()
    .min(1, { message: 'Message content cannot be empty' })
    .max(8000, { message: 'Message content cannot exceed 8000 characters' }),
});

export const chatRequestSchema = z
  .object({
    conversationId: z
      .string()
      .uuid({ message: 'Invalid conversationId format; must be a valid UUID' })
      .optional(),
    missionId: z
      .string()
      .uuid({ message: 'Invalid missionId format; must be a valid UUID' })
      .optional(),
    missionObjective: z
      .string()
      .trim()
      .min(1, { message: 'Mission objective cannot be empty' })
      .max(4000, { message: 'Mission objective cannot exceed 4000 characters' })
      .optional(),
    message: z
      .string()
      .trim()
      .min(1, { message: 'Message cannot be empty' })
      .max(8000, { message: 'Message cannot exceed 8000 characters' })
      .optional(),
    messages: z
      .array(chatMessageSchema)
      .min(1, { message: 'At least one message is required' })
      .max(40, { message: 'Message history cannot exceed 40 messages' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    // If conversationId is supplied, either 'message' or 'messages' must be supplied
    if (data.conversationId) {
      if (!data.message && (!data.messages || data.messages.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Either message or messages must be provided when continuing a conversation',
          path: ['message'],
        });
      }
    } else {
      // Stateless mode requires missionObjective and messages
      if (!data.missionObjective || data.missionObjective.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mission objective is required',
          path: ['missionObjective'],
        });
      }
      if (!data.messages || data.messages.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Messages array is required',
          path: ['messages'],
        });
      }
    }

    if (data.messages && data.messages.length > 0) {
      const lastMessage = data.messages[data.messages.length - 1];
      if (lastMessage && lastMessage.role !== 'user') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The final message must have the user role',
          path: ['messages'],
        });
      }
    }
  });

export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
