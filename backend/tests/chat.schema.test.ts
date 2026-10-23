import { describe, it, expect } from 'vitest';
import { chatRequestSchema } from '../src/schemas/chat.schema';

describe('chatRequestSchema validation', () => {
  const validPayload = {
    missionObjective: 'Build a Go CRUD API',
    messages: [
      {
        role: 'user',
        content: 'What is middleware in Go?',
      },
    ],
  };

  it('passes validation for a valid chat request', () => {
    const result = chatRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.missionObjective).toBe('Build a Go CRUD API');
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.messages[0]?.role).toBe('user');
    }
  });

  it('passes validation for multi-turn conversation ending in user role', () => {
    const multiTurnPayload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [
        { role: 'user', content: 'What is middleware?' },
        { role: 'assistant', content: 'Middleware is code that runs before or after handlers.' },
        { role: 'user', content: 'How do I write one in Go?' },
      ],
    };
    const result = chatRequestSchema.safeParse(multiTurnPayload);
    expect(result.success).toBe(true);
  });

  it('rejects missing mission objective', () => {
    const payload = {
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty mission objective', () => {
    const payload = {
      missionObjective: '   ',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects missing messages array', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty messages array', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty message content', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [{ role: 'user', content: '   ' }],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects unsupported roles', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [{ role: 'system', content: 'System instruction' }],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects more than 40 messages', () => {
    const messages = Array.from({ length: 41 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
    }));
    // ensure last message is user
    messages[40] = { role: 'user', content: 'Message 40' };

    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages,
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects when the final message is assistant role', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there, how can I help?' },
      ],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'The final message must have the user role');
      expect(issue).toBeDefined();
    }
  });

  it('rejects oversized mission objective (> 4000 chars)', () => {
    const payload = {
      missionObjective: 'a'.repeat(4001),
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects oversized message content (> 8000 chars)', () => {
    const payload = {
      missionObjective: 'Build a Go CRUD API',
      messages: [{ role: 'user', content: 'a'.repeat(8001) }],
    };
    const result = chatRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  describe('Persistent conversation schema mode', () => {
    it('accepts conversationId with message string', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'How do I add CORS in Go?',
      };
      const result = chatRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('accepts conversationId with messages array', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        messages: [{ role: 'user', content: 'How do I add CORS in Go?' }],
      };
      const result = chatRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID conversationId format', () => {
      const payload = {
        conversationId: 'not-a-valid-uuid',
        message: 'Hello',
      };
      const result = chatRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects conversationId with no message or messages', () => {
      const payload = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = chatRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
