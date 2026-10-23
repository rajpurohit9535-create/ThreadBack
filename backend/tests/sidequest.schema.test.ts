import { describe, it, expect } from 'vitest';
import { sideQuestRequestSchema } from '../src/schemas/sidequest.schema';

describe('sideQuestRequestSchema validation', () => {
  const validPayload = {
    missionObjective: 'Build a Go CRUD API',
    sideQuestTopic: 'Middleware in Go',
    messages: [
      {
        role: 'user',
        content: 'What is middleware in Go?',
      },
    ],
  };

  it('passes validation for a valid SideQuest request', () => {
    const result = sideQuestRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.missionObjective).toBe('Build a Go CRUD API');
      expect(result.data.sideQuestTopic).toBe('Middleware in Go');
      expect(result.data.messages).toHaveLength(1);
    }
  });

  it('rejects missing missionObjective', () => {
    const payload = {
      sideQuestTopic: 'Middleware in Go',
      messages: [{ role: 'user', content: 'What is middleware?' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty missionObjective', () => {
    const payload = {
      missionObjective: '   ',
      sideQuestTopic: 'Middleware in Go',
      messages: [{ role: 'user', content: 'What is middleware?' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects missing sideQuestTopic', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [{ role: 'user', content: 'What is middleware?' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty sideQuestTopic', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: '   ',
      messages: [{ role: 'user', content: 'What is middleware?' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects oversized sideQuestTopic (> 500 chars)', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'x'.repeat(501),
      messages: [{ role: 'user', content: 'What is middleware?' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects missing messages array', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty messages array', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages: [],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty message content', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages: [{ role: 'user', content: '   ' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects unsupported roles', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages: [{ role: 'system', content: 'Explain middleware' }],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects when final message has assistant role', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages: [
        { role: 'user', content: 'Explain middleware' },
        { role: 'assistant', content: 'Middleware is an HTTP wrapper.' },
      ],
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'The final message must have the user role');
      expect(issue).toBeDefined();
    }
  });

  it('rejects more than 40 messages', () => {
    const messages = Array.from({ length: 41 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
    }));
    messages[40] = { role: 'user', content: 'Message 40' };

    const payload = {
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages,
    };
    const result = sideQuestRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  describe('Persistent SideQuest schema mode', () => {
    it('accepts conversationId with message string', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'How do I add CORS in Go?',
      };
      const result = sideQuestRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('accepts conversationId with missionId and message', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        missionId: '223e4567-e89b-12d3-a456-426614174000',
        message: 'How do I add CORS in Go?',
      };
      const result = sideQuestRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID conversationId format', () => {
      const payload = {
        conversationId: 'invalid-uuid',
        message: 'Hello',
      };
      const result = sideQuestRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUID missionId format', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        missionId: 'invalid-mission-uuid',
        message: 'Hello',
      };
      const result = sideQuestRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects conversationId with no message or messages', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = sideQuestRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
