import { env } from '../config/env';
import { executeGemmaGeneration, GenerateGemmaParams } from '../lib/gemma-client';
import { buildReturnToMissionPrompt } from '../prompts/return-to-mission.prompt';
import {
  conversationRepository,
  missionRepository,
  messageRepository,
  memoryRepository,
} from '../db';
import { ApiError } from '../utils/api-error';
import {
  sideQuestLearningSummarySchema,
  SideQuestLearningSummary,
} from '../schemas/return-to-mission.schema';
import { ReturnToMissionResponse } from '../types/ai.types';

function extractJsonObject(text: string): unknown {
  let clean = text.trim();
  // Strip markdown code fences if wrapped
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(clean);
}

export class ReturnToMissionService {
  private readonly generateFn: (params: GenerateGemmaParams) => Promise<string>;
  private readonly model?: string;

  constructor(
    generateFn: (params: GenerateGemmaParams) => Promise<string> = executeGemmaGeneration,
    model?: string
  ) {
    this.generateFn = generateFn;
    this.model = model;
  }

  /**
   * Synthesizes learning from a SideQuest and transfers it to the parent mission.
   */
  async returnToMission(sideQuestConversationId: string): Promise<ReturnToMissionResponse> {
    const activeModel = this.model || env.gemmaModel;

    // 1. Validate SideQuest conversation exists
    const conversation = conversationRepository.getConversationById(sideQuestConversationId);
    if (!conversation) {
      throw ApiError.notFound(`SideQuest conversation with ID ${sideQuestConversationId} not found.`);
    }
    if (conversation.type !== 'sidequest') {
      throw ApiError.badRequest(
        `Conversation ${sideQuestConversationId} is a Main conversation, not a SideQuest.`
      );
    }

    // 2. Retrieve parent mission and main conversation
    const mission = missionRepository.getMissionById(conversation.missionId);
    if (!mission) {
      throw ApiError.notFound(`Mission with ID ${conversation.missionId} not found.`);
    }

    const mainConversation = conversationRepository.getMainConversationByMissionId(conversation.missionId);
    if (!mainConversation) {
      throw ApiError.notFound(`Main conversation for mission ${conversation.missionId} not found.`);
    }

    // 3. Load authoritative SideQuest history from SQLite
    const messages = messageRepository.getMessagesByConversationId(conversation.id, 100);
    const sideQuestTopic = conversation.topic || 'Technical Exploration';

    let summary: SideQuestLearningSummary;

    // 4. If conversation has zero messages, return a deterministic insufficient-history summary
    if (messages.length === 0) {
      summary = {
        topic: sideQuestTopic,
        keyLearnings: ['No messages were exchanged in this SideQuest.'],
        decisions: [],
        usefulExamples: [],
        unresolvedQuestions: [],
        missionRelevance: `Exploration on '${sideQuestTopic}' was initiated, but no messages were exchanged before returning to mission.`,
      };
    } else {
      // Build transcript representation for synthesis
      const transcript = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      const systemInstruction = buildReturnToMissionPrompt(mission.objective, sideQuestTopic);

      let rawOutput: string;
      try {
        rawOutput = await this.generateFn({
          model: activeModel,
          systemInstruction,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Please synthesize the following SideQuest conversation into the structured JSON learning summary:\n\n${transcript}`,
                },
              ],
            },
          ],
        });
      } catch (error) {
        throw error instanceof ApiError
          ? error
          : ApiError.providerError(
              `AI provider error during learning summary synthesis: ${
                error instanceof Error ? error.message : 'Unknown provider error'
              }`
            );
      }

      // 5. Parse and validate generated summary strictly
      try {
        const parsedJson = extractJsonObject(rawOutput);
        summary = sideQuestLearningSummarySchema.parse(parsedJson);
      } catch (validationError) {
        throw ApiError.providerError(
          `AI provider produced malformed or invalid summary structure: ${
            validationError instanceof Error ? validationError.message : 'Invalid JSON'
          }`
        );
      }
    }

    // 6. Save structured summary in sidequest_memories
    memoryRepository.upsertSideQuestStructuredSummary(conversation.id, summary);

    // 7. Merge decisions into mission memory safely
    if (summary.decisions && summary.decisions.length > 0) {
      memoryRepository.mergeDecisionsIntoMissionMemory(
        mission.id,
        summary.decisions,
        summary.missionRelevance
      );
    }

    return {
      summary,
      missionId: mission.id,
      mainConversationId: mainConversation.id,
      sideQuestConversationId: conversation.id,
    };
  }
}

export const returnToMissionService = new ReturnToMissionService();
