import { env } from '../config/env';
import { executeGemmaGeneration, GenerateGemmaParams } from '../lib/gemma-client';
import { buildSideQuestSystemPrompt } from '../prompts/sidequest.prompt';
import { SideQuestRequest, ChatResponse, GemmaContentMessage } from '../types/ai.types';
import {
  conversationRepository,
  missionRepository,
  messageRepository,
} from '../db';
import { ApiError } from '../utils/api-error';

export interface UserContext {
  id: string;
  name: string;
}

export class SideQuestService {
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
   * Orchestrates the SideQuest exploratory AI interaction.
   * Supports both persisted SideQuest conversations and stateless mode.
   */
  async processSideQuestChat(request: SideQuestRequest, currentUser?: UserContext): Promise<ChatResponse> {
    const activeModel = this.model || env.gemmaModel;

    // --- Persisted SideQuest Conversation Mode ---
    if (request.conversationId) {
      const conversation = conversationRepository.getConversationById(request.conversationId);
      if (!conversation) {
        throw ApiError.notFound(`SideQuest conversation with ID ${request.conversationId} not found.`);
      }
      if (conversation.type !== 'sidequest') {
        throw ApiError.badRequest(`Conversation ${request.conversationId} is a Main conversation, not a SideQuest.`);
      }

      if (request.missionId && request.missionId !== conversation.missionId) {
        throw ApiError.badRequest(`Mission ID mismatch for SideQuest conversation ${request.conversationId}.`);
      }

      const mission = missionRepository.getMissionById(conversation.missionId);
      if (!mission) {
        throw ApiError.notFound(`Mission with ID ${conversation.missionId} not found.`);
      }

      const sideQuestTopic = conversation.topic || request.sideQuestTopic || 'Technical Exploration';

      // Determine incoming user message content
      let userMessageText = '';
      if (request.message && request.message.trim().length > 0) {
        userMessageText = request.message.trim();
      } else if (request.messages && request.messages.length > 0) {
        const lastMsg = request.messages[request.messages.length - 1];
        if (lastMsg) {
          userMessageText = lastMsg.content.trim();
        }
      }

      if (!userMessageText) {
        throw ApiError.badRequest('A non-empty user message is required.');
      }

      // Load authoritative history from SQLite (recent context window)
      const storedMessages = messageRepository.getRecentContextMessages(conversation.id, 30);
      const formattedHistory: GemmaContentMessage[] = storedMessages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.userName ? `${msg.userName}: ${msg.content}` : msg.content }],
      }));

      // Append incoming user message
      const incomingText = currentUser?.name ? `${currentUser.name}: ${userMessageText}` : userMessageText;
      const formattedContents: GemmaContentMessage[] = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: incomingText }] },
      ];

      // Save user message to SQLite with author tracking
      const userMessage = messageRepository.createMessage(conversation.id, 'user', userMessageText, {
        userId: currentUser?.id,
        userName: currentUser?.name,
      });
      conversationRepository.touchConversation(conversation.id);

      // Build dedicated SideQuest system instruction
      const systemInstruction = buildSideQuestSystemPrompt(mission.objective, sideQuestTopic);

      // Invoke shared Gemma model with rollback guard
      let reply: string;
      try {
        reply = await this.generateFn({
          model: activeModel,
          systemInstruction,
          contents: formattedContents,
        });
      } catch (error) {
        // Rollback user message so failed turn doesn't leave orphaned state in history
        messageRepository.deleteMessage(userMessage.id);
        throw error;
      }

      // Persist assistant response
      messageRepository.createMessage(conversation.id, 'assistant', reply);
      conversationRepository.touchConversation(conversation.id);

      return {
        reply,
        conversationId: conversation.id,
        missionId: mission.id,
        sideQuestTopic,
      };
    }

    // --- Stateless Fallback Mode ---
    const objective = request.missionObjective || '';
    const sideQuestTopic = request.sideQuestTopic || 'Technical Exploration';
    const messages = request.messages || [];

    if (messages.length === 0 && !request.message) {
      throw ApiError.badRequest('At least one user message or conversationId is required.');
    }

    const formattedContents: GemmaContentMessage[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (request.message && request.message.trim().length > 0) {
      formattedContents.push({
        role: 'user',
        parts: [{ text: request.message.trim() }],
      });
    }

    const systemInstruction = buildSideQuestSystemPrompt(objective, sideQuestTopic);
    const reply = await this.generateFn({
      model: activeModel,
      systemInstruction,
      contents: formattedContents,
    });

    return {
      reply,
    };
  }
}

export const sideQuestService = new SideQuestService();
