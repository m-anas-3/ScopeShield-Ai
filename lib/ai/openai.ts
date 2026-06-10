import "server-only";

import OpenAI from "openai";

import { optionalPositiveIntegerEnv, requiredServerEnv } from "@/lib/env/server";

const DEFAULT_TIMEOUT_MS = 45_000;

let openai: OpenAI | null = null;

export const ANALYSIS_MODEL =
  process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4o-mini";
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

function openAITimeout() {
  return optionalPositiveIntegerEnv("OPENAI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
}

export function getOpenAIClient() {
  const apiKey = requiredServerEnv("OPENAI_API_KEY");

  openai ??= new OpenAI({
    apiKey,
    maxRetries: 2,
    timeout: openAITimeout(),
  });

  return openai;
}

export default getOpenAIClient;
