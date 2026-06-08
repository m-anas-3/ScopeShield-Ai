import "server-only";

import getOpenAIClient, { EMBEDDING_MODEL } from "@/lib/ai/openai";

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  tokenCount: number;
}

export async function embedTexts(input: string[]): Promise<EmbeddingResult> {
  if (input.length === 0) {
    return {
      embeddings: [],
      model: EMBEDDING_MODEL,
      tokenCount: 0,
    };
  }

  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return {
    embeddings: response.data.map((item) => item.embedding),
    model: response.model ?? EMBEDDING_MODEL,
    tokenCount: response.usage?.total_tokens ?? 0,
  };
}

export async function embedText(input: string) {
  const result = await embedTexts([input]);
  const embedding = result.embeddings[0];

  if (!embedding) {
    throw new Error("Embedding generation failed.");
  }

  return {
    embedding,
    model: result.model,
    tokenCount: result.tokenCount,
  };
}
