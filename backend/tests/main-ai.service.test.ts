import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainAiService } from '../src/services/main-ai.service';
import { GenerateGemmaParams } from '../lib/gemma-client';
import { BASE_SYSTEM_INSTRUCTION } from '../src/prompts/main-ai.prompt';

/**
 * Unit / Integration-boundary tests for MainAiService.
 * NOTE: These tests use a controlled test stub for the provider boundary to test orchestration deterministically.
 * These are NOT live Gemma inference tests.
 */
describe('MainAiService (Unit / Boundary Stub Tests)', () => {
  it('combines mission objective into system instruction and maps roles to Gemini format', async () => {
    let capturedParams: GenerateGemmaParams | null = null;

    const stubGenerateFn = vi.fn(async (params: GenerateGemmaParams): Promise<string> => {
      capturedParams = params;
      return 'Go middleware wraps http.Handler.';
    });

    const service = new MainAiService(stubGenerateFn, 'gemma-2-9b-it');

    const result = await service.processChat({
      missionObjective: 'Build a Go CRUD API',
      messages: [
        { role: 'user', content: 'What is middleware in Go?' },
        { role: 'assistant', content: 'It wraps HTTP handlers.' },
        { role: 'user', content: 'Can you show an example?' },
      ],
    });

    expect(result).toEqual({ reply: 'Go middleware wraps http.Handler.' });
    expect(stubGenerateFn).toHaveBeenCalledTimes(1);

    expect(capturedParams).not.toBeNull();
    if (capturedParams) {
      const p = capturedParams as GenerateGemmaParams;
      expect(p.model).toBe('gemma-2-9b-it');
      expect(p.systemInstruction).toContain(BASE_SYSTEM_INSTRUCTION);
      expect(p.systemInstruction).toContain('[CURRENT MISSION OBJECTIVE]');
      expect(p.systemInstruction).toContain('Build a Go CRUD API');

      // Check role mapping: assistant -> model, user -> user
      expect(p.contents).toEqual([
        { role: 'user', parts: [{ text: 'What is middleware in Go?' }] },
        { role: 'model', parts: [{ text: 'It wraps HTTP handlers.' }] },
        { role: 'user', parts: [{ text: 'Can you show an example?' }] },
      ]);
    }
  });

  it('propagates provider errors cleanly without swallowing them', async () => {
    const stubGenerateFn = vi.fn(async (): Promise<string> => {
      throw new Error('Upstream provider network drop');
    });

    const service = new MainAiService(stubGenerateFn, 'gemma-2-9b-it');

    await expect(
      service.processChat({
        missionObjective: 'Build a Go CRUD API',
        messages: [{ role: 'user', content: 'What is middleware?' }],
      })
    ).rejects.toThrow('Upstream provider network drop');
  });

  describe('Persistent Conversation Mode', () => {
    let missionId: string;
    let mainConversationId: string;

    beforeEach(async () => {
      const { initDatabase, closeDatabase, missionRepository } = await import('../src/db');
      closeDatabase();
      initDatabase(':memory:');
      const result = missionRepository.createMissionWithMainConversation('Build a Go CRUD API');
      missionId = result.mission.id;
      mainConversationId = result.mainConversation.id;
    });

    afterEach(async () => {
      const { closeDatabase } = await import('../src/db');
      closeDatabase();
    });

    it('persists user message and assistant reply, continuing conversation across turns', async () => {
      const { messageRepository } = await import('../src/db');
      let capturedParams: GenerateGemmaParams | null = null;

      const stubGenerateFn = vi.fn(async (params: GenerateGemmaParams): Promise<string> => {
        capturedParams = params;
        return 'Turn 1 assistant answer';
      });

      const service = new MainAiService(stubGenerateFn, 'gemma-4-26b-a4b-it');

      // Turn 1
      const res1 = await service.processChat({
        conversationId: mainConversationId,
        message: 'Turn 1 user question',
      });

      expect(res1.reply).toBe('Turn 1 assistant answer');
      expect(res1.conversationId).toBe(mainConversationId);
      expect(res1.missionId).toBe(missionId);

      // Verify messages stored in DB
      let messages = messageRepository.getMessagesByConversationId(mainConversationId);
      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('Turn 1 user question');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[1]?.content).toBe('Turn 1 assistant answer');

      // Turn 2
      stubGenerateFn.mockImplementationOnce(async (params: GenerateGemmaParams) => {
        capturedParams = params;
        return 'Turn 2 assistant answer';
      });

      const res2 = await service.processChat({
        conversationId: mainConversationId,
        message: 'Turn 2 user question',
      });

      expect(res2.reply).toBe('Turn 2 assistant answer');
      messages = messageRepository.getMessagesByConversationId(mainConversationId);
      expect(messages).toHaveLength(4);

      // Verify Turn 2 passed Turn 1 history from DB to Gemma
      expect(capturedParams?.contents).toEqual([
        { role: 'user', parts: [{ text: 'Turn 1 user question' }] },
        { role: 'model', parts: [{ text: 'Turn 1 assistant answer' }] },
        { role: 'user', parts: [{ text: 'Turn 2 user question' }] },
      ]);
    });

    it('does not fabricate assistant response or orphan user message when provider fails', async () => {
      const { messageRepository } = await import('../src/db');

      const stubGenerateFn = vi.fn(async (): Promise<string> => {
        throw new Error('Gemma provider 503 service unavailable');
      });

      const service = new MainAiService(stubGenerateFn, 'gemma-4-26b-a4b-it');

      await expect(
        service.processChat({
          conversationId: mainConversationId,
          message: 'Failing turn question',
        })
      ).rejects.toThrow('Gemma provider 503 service unavailable');

      // Crucial test requirement: provider failure must NOT fabricate assistant response
      // or corrupt conversation history with orphaned user message
      const messages = messageRepository.getMessagesByConversationId(mainConversationId);
      expect(messages).toHaveLength(0);
    });

    it('rejects nonexistent conversationId with 404', async () => {
      const service = new MainAiService(vi.fn(), 'gemma-4-26b-a4b-it');
      await expect(
        service.processChat({
          conversationId: '00000000-0000-0000-0000-000000000000',
          message: 'Hello',
        })
      ).rejects.toThrow(/not found/i);
    });

    it('rejects mismatched missionId with 400', async () => {
      const service = new MainAiService(vi.fn(), 'gemma-4-26b-a4b-it');
      await expect(
        service.processChat({
          conversationId: mainConversationId,
          missionId: '00000000-0000-0000-0000-000000000000',
          message: 'Hello',
        })
      ).rejects.toThrow(/mismatch/i);
    });

    it('rejects SideQuest conversation ID passed to Main AI with 400', async () => {
      const { conversationRepository } = await import('../src/db');
      const sideQuest = conversationRepository.createSideQuestConversation(missionId, 'Subtopic');

      const service = new MainAiService(vi.fn(), 'gemma-4-26b-a4b-it');
      await expect(
        service.processChat({
          conversationId: sideQuest.id,
          message: 'Hello',
        })
      ).rejects.toThrow(/is a SideQuest, not a Main conversation/i);
    });
  });
});
