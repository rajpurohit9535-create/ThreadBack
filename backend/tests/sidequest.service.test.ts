import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SideQuestService } from '../src/services/sidequest.service';
import { MainAiService } from '../src/services/main-ai.service';
import { GenerateGemmaParams } from '../src/lib/gemma-client';
import { BASE_SIDEQUEST_SYSTEM_INSTRUCTION } from '../src/prompts/sidequest.prompt';
import { BASE_SYSTEM_INSTRUCTION } from '../src/prompts/main-ai.prompt';

/**
 * Unit / Integration-boundary tests for SideQuestService.
 * NOTE: These tests use a controlled test stub for the provider boundary to test orchestration deterministically.
 * These are NOT live Gemma inference tests.
 */
describe('SideQuestService (Unit / Boundary Stub Tests)', () => {
  it('combines mission objective and sideQuestTopic into SideQuest prompt and maps roles', async () => {
    let capturedParams: GenerateGemmaParams | null = null;

    const stubGenerateFn = vi.fn(async (params: GenerateGemmaParams): Promise<string> => {
      capturedParams = params;
      return 'In Go, middleware functions wrap http.Handler to intercept requests.';
    });

    const service = new SideQuestService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    const result = await service.processSideQuestChat({
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages: [
        { role: 'user', content: 'What is middleware in Go?' },
        { role: 'assistant', content: 'It wraps HTTP handlers.' },
        { role: 'user', content: 'How do I log requests?' },
      ],
    });

    expect(result).toEqual({
      reply: 'In Go, middleware functions wrap http.Handler to intercept requests.',
    });
    expect(stubGenerateFn).toHaveBeenCalledTimes(1);

    expect(capturedParams).not.toBeNull();
    if (capturedParams) {
      const p = capturedParams as GenerateGemmaParams;
      expect(p.model).toBe('gemma-4-26b-a4b-it');

      // Verify SideQuest system prompt is used, NOT Main AI prompt
      expect(p.systemInstruction).toContain(BASE_SIDEQUEST_SYSTEM_INSTRUCTION);
      expect(p.systemInstruction).not.toContain(BASE_SYSTEM_INSTRUCTION);

      // Verify both mission objective and SideQuest topic are injected
      expect(p.systemInstruction).toContain('[MAIN MISSION OBJECTIVE]');
      expect(p.systemInstruction).toContain('Build a Go CRUD API');
      expect(p.systemInstruction).toContain('[CURRENT SIDEQUEST TOPIC]');
      expect(p.systemInstruction).toContain('Middleware in Go');

      // Verify role mapping: assistant -> model, user -> user
      expect(p.contents).toEqual([
        { role: 'user', parts: [{ text: 'What is middleware in Go?' }] },
        { role: 'model', parts: [{ text: 'It wraps HTTP handlers.' }] },
        { role: 'user', parts: [{ text: 'How do I log requests?' }] },
      ]);
    }
  });

  it('keeps Main AI and SideQuest conversation histories strictly separate', async () => {
    const mainCaptured: GenerateGemmaParams[] = [];
    const sideQuestCaptured: GenerateGemmaParams[] = [];

    const mainStub = vi.fn(async (params: GenerateGemmaParams) => {
      mainCaptured.push(params);
      return 'Main AI response';
    });

    const sideQuestStub = vi.fn(async (params: GenerateGemmaParams) => {
      sideQuestCaptured.push(params);
      return 'SideQuest AI response';
    });

    const mainService = new MainAiService(mainStub, 'gemma-4-26b-a4b-it');
    const sideQuestService = new SideQuestService(sideQuestStub, 'gemma-4-26b-a4b-it');

    // 1. User asks Main AI
    await mainService.processChat({
      missionObjective: 'Build a Go CRUD API',
      messages: [{ role: 'user', content: 'Create a users database table in Go' }],
    });

    // 2. User starts a separate SideQuest on Middleware
    await sideQuestService.processSideQuestChat({
      missionObjective: 'Build a Go CRUD API',
      sideQuestTopic: 'Middleware in Go',
      messages: [{ role: 'user', content: 'Explain what net/http middleware is' }],
    });

    // Verify Main AI call did NOT receive the SideQuest topic or message
    expect(mainCaptured).toHaveLength(1);
    expect(mainCaptured[0]?.systemInstruction).not.toContain('Middleware in Go');
    expect(mainCaptured[0]?.contents).toEqual([
      { role: 'user', parts: [{ text: 'Create a users database table in Go' }] },
    ]);

    // Verify SideQuest call did NOT receive the Main AI table creation message
    expect(sideQuestCaptured).toHaveLength(1);
    expect(sideQuestCaptured[0]?.systemInstruction).toContain('Middleware in Go');
    expect(sideQuestCaptured[0]?.contents).toEqual([
      { role: 'user', parts: [{ text: 'Explain what net/http middleware is' }] },
    ]);
  });

  it('propagates provider errors cleanly without leaking secrets', async () => {
    const stubGenerateFn = vi.fn(async (): Promise<string> => {
      throw new Error('Upstream provider timeout');
    });

    const service = new SideQuestService(stubGenerateFn, 'gemma-4-26b-a4b-it');

    await expect(
      service.processSideQuestChat({
        missionObjective: 'Build a Go CRUD API',
        sideQuestTopic: 'Middleware in Go',
        messages: [{ role: 'user', content: 'What is middleware?' }],
      })
    ).rejects.toThrow('Upstream provider timeout');
  });

  describe('Persistent SideQuest Mode', () => {
    let missionId: string;
    let mainConversationId: string;
    let sideQuestId: string;

    beforeEach(async () => {
      const { initDatabase, closeDatabase, missionRepository, conversationRepository } = await import('../src/db');
      closeDatabase();
      initDatabase(':memory:');
      const result = missionRepository.createMissionWithMainConversation('Build a Go CRUD API');
      missionId = result.mission.id;
      mainConversationId = result.mainConversation.id;

      const sq = conversationRepository.createSideQuestConversation(missionId, 'Middleware in Go');
      sideQuestId = sq.id;
    });

    afterEach(async () => {
      const { closeDatabase } = await import('../src/db');
      closeDatabase();
    });

    it('persists SideQuest turns and injects topic and mission from DB into system prompt', async () => {
      const { messageRepository } = await import('../src/db');
      let capturedParams: GenerateGemmaParams | null = null;

      const stubGenerateFn = vi.fn(async (params: GenerateGemmaParams): Promise<string> => {
        capturedParams = params;
        return 'SideQuest assistant explanation';
      });

      const service = new SideQuestService(stubGenerateFn, 'gemma-4-26b-a4b-it');

      const res = await service.processSideQuestChat({
        conversationId: sideQuestId,
        message: 'How to write middleware in Go?',
      });

      expect(res.reply).toBe('SideQuest assistant explanation');
      expect(res.conversationId).toBe(sideQuestId);
      expect(res.missionId).toBe(missionId);
      expect(res.sideQuestTopic).toBe('Middleware in Go');

      expect(capturedParams?.systemInstruction).toContain('Build a Go CRUD API');
      expect(capturedParams?.systemInstruction).toContain('Middleware in Go');

      const messages = messageRepository.getMessagesByConversationId(sideQuestId);
      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('How to write middleware in Go?');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[1]?.content).toBe('SideQuest assistant explanation');
    });

    it('does not fabricate assistant response or orphan user message when provider fails', async () => {
      const { messageRepository } = await import('../src/db');

      const stubGenerateFn = vi.fn(async (): Promise<string> => {
        throw new Error('Gemma provider failure');
      });

      const service = new SideQuestService(stubGenerateFn, 'gemma-4-26b-a4b-it');

      await expect(
        service.processSideQuestChat({
          conversationId: sideQuestId,
          message: 'Failing question',
        })
      ).rejects.toThrow('Gemma provider failure');

      const messages = messageRepository.getMessagesByConversationId(sideQuestId);
      expect(messages).toHaveLength(0);
    });

    it('rejects nonexistent SideQuest conversationId with 404', async () => {
      const service = new SideQuestService(vi.fn(), 'gemma-4-26b-a4b-it');
      await expect(
        service.processSideQuestChat({
          conversationId: '00000000-0000-0000-0000-000000000000',
          message: 'Hello',
        })
      ).rejects.toThrow(/not found/i);
    });

    it('rejects Main conversation ID passed to SideQuest endpoint with 400', async () => {
      const service = new SideQuestService(vi.fn(), 'gemma-4-26b-a4b-it');
      await expect(
        service.processSideQuestChat({
          conversationId: mainConversationId,
          message: 'Hello',
        })
      ).rejects.toThrow(/is a Main conversation, not a SideQuest/i);
    });

    it('rejects mismatched missionId with 400', async () => {
      const service = new SideQuestService(vi.fn(), 'gemma-4-26b-a4b-it');
      await expect(
        service.processSideQuestChat({
          conversationId: sideQuestId,
          missionId: '00000000-0000-0000-0000-000000000000',
          message: 'Hello',
        })
      ).rejects.toThrow(/mismatch/i);
    });
  });
});
