export type { ChatRole, ChatMessage, ChatRequest } from '../schemas/chat.schema';
export type { SideQuestRequest } from '../schemas/sidequest.schema';

export interface ChatResponse {
  reply: string;
  conversationId?: string;
  missionId?: string;
  sideQuestTopic?: string;
}

export interface ReturnToMissionResponse {
  summary: import('./db.types').SideQuestLearningSummary;
  missionId: string;
  mainConversationId: string;
  sideQuestConversationId: string;
}

export interface AiStatusResponse {
  configured: boolean;
  model: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface GemmaContentPart {
  text: string;
}

export interface GemmaContentMessage {
  role: 'user' | 'model';
  parts: GemmaContentPart[];
}
