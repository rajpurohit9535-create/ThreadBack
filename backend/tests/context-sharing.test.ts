import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { GenerateGemmaParams } from '../src/lib/gemma-client';
import { MainAiService } from '../src/services/main-ai.service';
import { ReturnToMissionService } from '../src/services/return-to-mission.service';
import {
  initDatabase,
  closeDatabase,
  missionRepository,
  conversationRepository,
  messageRepository,
  memoryRepository,
} from '../src/db';

describe('Phase 4: Return to Mission & Context Sharing Integration', () => {
  let missionId: string;
  let mainConvId: string;
  let sideQuestId: string;

  beforeEach(() => {
    closeDatabase();
    initDatabase(':memory:');

    const created = missionRepository.createMissionWithMainConversation('Build a Go CRUD API');
    missionId = created.mission.id;
    mainConvId = created.mainConversation.id;

    const sq = conversationRepository.createSideQuestConversation(missionId, 'Middleware in Go');
    sideQuestId = sq.id;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('transfers SideQuest learnings into Main AI context without merging message histories', async () => {
    // 1. Initial Main AI chat turn
    messageRepository.createMessage(mainConvId, 'user', 'How should I structure the HTTP routes?');
    messageRepository.createMessage(mainConvId, 'assistant', 'Use standard handler functions and register them on a multiplexer.');

    // 2. User explores SideQuest
    messageRepository.createMessage(sideQuestId, 'user', 'How do I write an auth middleware in Go?');
    messageRepository.createMessage(
      sideQuestId,
      'assistant',
      'Wrap http.Handler and check the Authorization header. If invalid, return http.StatusUnauthorized.'
    );

    // 3. User invokes Return to Mission
    const returnSummary = {
      topic: 'Middleware in Go',
      keyLearnings: ['Auth middleware inspects Authorization header before calling next handler.'],
      decisions: ['Implement JWT authentication as standard middleware.'],
      usefulExamples: ['func AuthMiddleware(next http.Handler) http.Handler'],
      unresolvedQuestions: [],
      missionRelevance: 'Secures user CRUD endpoints for the Go API.',
    };

    const returnService = new ReturnToMissionService(async () => JSON.stringify(returnSummary));
    await returnService.returnToMission(sideQuestId);

    // 4. User sends next message to Main AI
    let capturedMainParams: GenerateGemmaParams | null = null;
    const mainAiStub = vi.fn(async (params: GenerateGemmaParams) => {
      capturedMainParams = params;
      return 'Great, now let us integrate your JWT AuthMiddleware into the router setup.';
    });

    const mainAiService = new MainAiService(mainAiStub, 'gemma-4-26b-a4b-it');

    const mainResponse = await mainAiService.processChat({
      conversationId: mainConvId,
      message: 'Now how do I attach the middleware to all my routes?',
    });

    expect(mainResponse.reply).toContain('integrate your JWT AuthMiddleware');

    // 5. Verify Main AI prompt received [RELEVANT SIDEQUEST LEARNINGS]
    expect(capturedMainParams).not.toBeNull();
    const systemPrompt = capturedMainParams!.systemInstruction;
    expect(systemPrompt).toContain('[RELEVANT SIDEQUEST LEARNINGS]');
    expect(systemPrompt).toContain('Middleware in Go');
    expect(systemPrompt).toContain('Implement JWT authentication as standard middleware.');

    // 6. Verify strictly isolated message history: SideQuest messages were NOT appended to Main AI history
    const mainMessages = messageRepository.getMessagesByConversationId(mainConvId);
    expect(mainMessages).toHaveLength(4); // 2 original + 1 user + 1 assistant
    expect(mainMessages.map((m) => m.content)).not.toContain('How do I write an auth middleware in Go?');

    const sqMessages = messageRepository.getMessagesByConversationId(sideQuestId);
    expect(sqMessages).toHaveLength(2); // strictly unchanged

    // 7. Verify Turn 2: summary is not repeatedly re-injected as raw SideQuest summary block once incorporated
    let capturedTurn2Params: GenerateGemmaParams | null = null;
    mainAiStub.mockImplementationOnce(async (params) => {
      capturedTurn2Params = params;
      return 'Router handlers are now fully registered.';
    });

    await mainAiService.processChat({
      conversationId: mainConvId,
      message: 'Can we add tests for these handlers?',
    });

    // The raw [RELEVANT SIDEQUEST LEARNINGS] block is not duplicated
    expect(capturedTurn2Params!.systemInstruction).not.toContain('[RELEVANT SIDEQUEST LEARNINGS]');
    // But the decision remains present in [MISSION MEMORY]
    expect(capturedTurn2Params!.systemInstruction).toContain('[MISSION MEMORY]');
    expect(capturedTurn2Params!.systemInstruction).toContain('Implement JWT authentication as standard middleware.');
  });

  it('bounds context inclusion when multiple SideQuests exist for the same mission', async () => {
    // Create second SideQuest
    const sq2 = conversationRepository.createSideQuestConversation(missionId, 'Database Connection Pooling');
    const sq3 = conversationRepository.createSideQuestConversation(missionId, 'Docker Deployment');

    // Return all three SideQuests
    memoryRepository.upsertSideQuestStructuredSummary(sideQuestId, {
      topic: 'Middleware in Go',
      keyLearnings: ['Middleware wraps handlers.'],
      decisions: ['Use standard net/http.'],
      usefulExamples: [],
      unresolvedQuestions: [],
      missionRelevance: 'API security.',
    });

    memoryRepository.upsertSideQuestStructuredSummary(sq2.id, {
      topic: 'Database Connection Pooling',
      keyLearnings: ['SetMaxOpenConns prevents connection exhaustion.'],
      decisions: ['Configure pool to 25 open connections.'],
      usefulExamples: [],
      unresolvedQuestions: [],
      missionRelevance: 'Database performance.',
    });

    memoryRepository.upsertSideQuestStructuredSummary(sq3.id, {
      topic: 'Docker Deployment',
      keyLearnings: ['Use multi-stage Dockerfile for small Go binary images.'],
      decisions: ['Build scratch/alpine image.'],
      usefulExamples: [],
      unresolvedQuestions: [],
      missionRelevance: 'Deployment target.',
    });

    let capturedParams: GenerateGemmaParams | null = null;
    const mainService = new MainAiService(async (params) => {
      capturedParams = params;
      return 'Reply with bounded context';
    });

    await mainService.processChat({
      conversationId: mainConvId,
      message: 'What should our main server initialization do?',
    });

    // Bounded limit: at most 2 most recent unincorporated summaries are injected into prompt
    const prompt = capturedParams!.systemInstruction;
    expect(prompt).toContain('[RELEVANT SIDEQUEST LEARNINGS]');
    expect(prompt).toContain('Docker Deployment');
    expect(prompt).toContain('Database Connection Pooling');
    // Third oldest is bounded out
    expect(prompt).not.toContain('Topic: Middleware in Go');
  });

  describe('HTTP Route: POST /api/conversations/:id/return-to-mission', () => {
    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app).post('/api/conversations/not-a-valid-uuid/return-to-mission');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 404 for nonexistent conversation ID', async () => {
      const res = await request(app).post(
        '/api/conversations/00000000-0000-0000-0000-000000000000/return-to-mission'
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 when conversation is a Main conversation, not a SideQuest', async () => {
      const res = await request(app).post(`/api/conversations/${mainConvId}/return-to-mission`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toContain('is a Main conversation, not a SideQuest');
    });

    it('returns 200 with structured summary for empty SideQuest', async () => {
      const res = await request(app).post(`/api/conversations/${sideQuestId}/return-to-mission`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('topic', 'Middleware in Go');
      expect(res.body.summary).toHaveProperty('keyLearnings');
      expect(res.body).toHaveProperty('missionId', missionId);
      expect(res.body).toHaveProperty('mainConversationId', mainConvId);
      expect(res.body).toHaveProperty('sideQuestConversationId', sideQuestId);
    });
  });
});
