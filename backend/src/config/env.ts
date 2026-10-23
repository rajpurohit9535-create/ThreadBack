import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ApiError } from '../utils/api-error';

// Ensure .env file is loaded into process.env before configuration evaluation.
// Search candidates: backend/.env, repo root .env, cwd/.env, and cwd/backend/.env.
const envCandidates = [
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

export interface EnvConfig {
  readonly port: number;
  readonly geminiApiKey: string | undefined;
  readonly gemmaModel: string;
  readonly corsOrigin: string;
  readonly nodeEnv: string;
  readonly isAiConfigured: boolean;
}

export const DEFAULT_PORT = 4000;
export const DEFAULT_GEMMA_MODEL = 'gemma-4-26b-a4b-it';
export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) return DEFAULT_PORT;
  const parsed = parseInt(rawPort, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT environment variable: "${rawPort}". Must be a valid port number between 1 and 65535.`);
  }
  return parsed;
}

export const env: EnvConfig = {
  get port(): number {
    return parsePort(process.env.PORT);
  },
  get geminiApiKey(): string | undefined {
    const rawApiKey = process.env.GEMINI_API_KEY?.trim();
    return rawApiKey && rawApiKey.length > 0 ? rawApiKey : undefined;
  },
  get gemmaModel(): string {
    return process.env.GEMMA_MODEL?.trim() || DEFAULT_GEMMA_MODEL;
  },
  get corsOrigin(): string {
    return process.env.CORS_ORIGIN?.trim() || DEFAULT_CORS_ORIGIN;
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV?.trim() || 'development';
  },
  get isAiConfigured(): boolean {
    const rawApiKey = process.env.GEMINI_API_KEY?.trim();
    return typeof rawApiKey === 'string' && rawApiKey.length > 0;
  },
};

/**
 * Returns the configured Gemini API key or throws a safe ServerConfiguration ApiError.
 * Never logs or prints the secret value.
 */
export function requireGeminiApiKey(): string {
  const key = env.geminiApiKey;
  if (!key) {
    throw ApiError.serverConfiguration('The AI service is not configured. GEMINI_API_KEY is missing.');
  }
  return key;
}
