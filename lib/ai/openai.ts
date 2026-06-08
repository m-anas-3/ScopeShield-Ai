import "server-only";

import OpenAI from "openai";

const DEFAULT_TIMEOUT_MS = 45_000;

let openai: OpenAI | null = null;

export const ANALYSIS_MODEL =
  process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4o-mini";
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

function openAITimeout() {
  const rawValue = process.env.OPENAI_TIMEOUT_MS;
  const timeout = rawValue ? Number(rawValue) : DEFAULT_TIMEOUT_MS;

  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
}

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  openai ??= new OpenAI({
    apiKey,
    maxRetries: 2,
    timeout: openAITimeout(),
  });

  return openai;
}

export default getOpenAIClient;
