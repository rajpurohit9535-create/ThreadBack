import { GoogleGenAI } from '@google/genai';
import { requireGeminiApiKey } from '../config/env';
import { ApiError } from '../utils/api-error';
import { GemmaContentMessage } from '../types/ai.types';

export interface GenerateGemmaParams {
  model: string;
  systemInstruction: string;
  contents: GemmaContentMessage[];
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 90000;

let cachedClient: GoogleGenAI | null = null;
let lastUsedKey: string | null = null;

/**
 * Returns an instance of GoogleGenAI initialized with the validated API key.
 */
export function getGoogleGenAiClient(): GoogleGenAI {
  const apiKey = requireGeminiApiKey();

  if (!cachedClient || lastUsedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    lastUsedKey = apiKey;
  }

  return cachedClient;
}

/**
 * Executes a hosted Gemma inference request using the official Google GenAI SDK.
 * Handles timeouts and translates upstream errors without exposing secrets.
 */
export async function executeGemmaGeneration(params: GenerateGemmaParams): Promise<string> {
  const { model, systemInstruction, contents, timeoutMs = DEFAULT_TIMEOUT_MS } = params;
  const ai = getGoogleGenAiClient();

  const abortController = new AbortController();
  const timer = setTimeout(() => {
    abortController.abort(new Error('REQUEST_TIMEOUT'));
  }, timeoutMs);

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        abortSignal: abortController.signal,
      },
    });

    const reply = response.text;

    if (!reply || reply.trim().length === 0) {
      throw ApiError.providerError('The AI provider returned an empty response.');
    }

    return reply.trim();
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (abortController.signal.aborted) {
      throw ApiError.timeout(`The AI provider request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    // Safely analyze the error without exposing raw secret tokens or stack traces to client
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('quota') || lowerMessage.includes('rate limit') || lowerMessage.includes('429') || lowerMessage.includes('resource_exhausted')) {
      throw ApiError.rateLimitError('AI provider rate limit or quota exceeded. Please try again later.');
    }

    if (lowerMessage.includes('api_key_invalid') || lowerMessage.includes('api key not valid') || lowerMessage.includes('unauthenticated') || lowerMessage.includes('401')) {
      throw ApiError.serverConfiguration('The configured Gemini API key is invalid or unauthorized.');
    }

    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      throw ApiError.providerError(`The requested Gemma model "${model}" was not found or is unavailable for this account.`);
    }

    throw ApiError.providerError('The AI provider request failed.', {
      hint: 'Verify GEMINI_API_KEY and GEMMA_MODEL configuration in your environment.',
    });
  } finally {
    clearTimeout(timer);
  }
}
