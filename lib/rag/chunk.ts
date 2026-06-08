import "server-only";

const MAX_CHUNK_CHARS = 1_200;
const CHUNK_OVERLAP_CHARS = 180;

export type ScopeChunkSource =
  | "original_scope"
  | "deliverables"
  | "exclusions"
  | "terms";

export interface ScopeSourceDocument {
  sourceField: ScopeChunkSource;
  title: string;
  text: string | number | null;
}

export interface ScopeChunkInput {
  chunkIndex: number;
  sourceField: ScopeChunkSource;
  chunkText: string;
  tokenEstimate: number;
}

export interface ScopeProjectForChunking {
  original_scope: string;
  deliverables: string | null;
  exclusions: string | null;
  revision_limit: number | null;
  hourly_rate: number | null;
}

function cleanText(value: string | number | null) {
  if (value === null) {
    return "";
  }

  return String(value).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function splitLongBlock(block: string) {
  if (block.length <= MAX_CHUNK_CHARS) {
    return [block];
  }

  const sentences = block
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const parts: string[] = [];
    for (let index = 0; index < block.length; index += MAX_CHUNK_CHARS) {
      parts.push(block.slice(index, index + MAX_CHUNK_CHARS).trim());
    }
    return parts.filter(Boolean);
  }

  const parts: string[] = [];
  let current = "";

  sentences.forEach((sentence) => {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length > MAX_CHUNK_CHARS && current) {
      parts.push(current);
      current = sentence;
      return;
    }

    current = candidate;
  });

  if (current) {
    parts.push(current);
  }

  return parts;
}

function chunkDocument(document: ScopeSourceDocument, startingIndex: number) {
  const text = cleanText(document.text);

  if (!text) {
    return [];
  }

  const blocks = text
    .split(/\n{2,}/)
    .flatMap((block) => splitLongBlock(block.trim()))
    .filter(Boolean);

  const chunks: ScopeChunkInput[] = [];
  let current = `${document.title}\n`;
  let chunkIndex = startingIndex;

  blocks.forEach((block) => {
    const candidate = `${current}${current.endsWith("\n") ? "" : "\n\n"}${block}`;

    if (candidate.length > MAX_CHUNK_CHARS && current.trim() !== document.title) {
      const chunkText = current.trim();
      chunks.push({
        chunkIndex,
        sourceField: document.sourceField,
        chunkText,
        tokenEstimate: estimateTokens(chunkText),
      });
      chunkIndex += 1;

      const overlap = chunkText.slice(-CHUNK_OVERLAP_CHARS).trim();
      current = overlap
        ? `${document.title}\nContext overlap: ${overlap}\n\n${block}`
        : `${document.title}\n${block}`;
      return;
    }

    current = candidate;
  });

  const finalText = current.trim();
  if (finalText && finalText !== document.title) {
    chunks.push({
      chunkIndex,
      sourceField: document.sourceField,
      chunkText: finalText,
      tokenEstimate: estimateTokens(finalText),
    });
  }

  return chunks;
}

export function buildScopeSourceDocuments(project: ScopeProjectForChunking) {
  const terms = [
    project.revision_limit === null
      ? null
      : `Revision limit: ${project.revision_limit}`,
    project.hourly_rate === null ? null : `Hourly rate: $${project.hourly_rate}/hr`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      sourceField: "original_scope",
      title: "Original scope",
      text: project.original_scope,
    },
    {
      sourceField: "deliverables",
      title: "Deliverables",
      text: project.deliverables,
    },
    {
      sourceField: "exclusions",
      title: "Exclusions",
      text: project.exclusions,
    },
    {
      sourceField: "terms",
      title: "Commercial terms",
      text: terms || null,
    },
  ] satisfies ScopeSourceDocument[];
}

export function chunkProjectScope(project: ScopeProjectForChunking) {
  const documents = buildScopeSourceDocuments(project);
  const chunks: ScopeChunkInput[] = [];

  documents.forEach((document) => {
    chunks.push(...chunkDocument(document, chunks.length));
  });

  return chunks;
}
