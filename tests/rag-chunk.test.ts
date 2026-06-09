import { describe, expect, it } from "vitest";

import { chunkProjectScope } from "../lib/rag/chunk";

describe("chunkProjectScope", () => {
  it("creates chunks for scope text and commercial terms", () => {
    const chunks = chunkProjectScope({
      original_scope: "Build a marketing website with a contact form.",
      deliverables: "Homepage, services page, and contact page.",
      exclusions: "No native mobile application is included.",
      revision_limit: 0,
      hourly_rate: 0,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index),
    );
    expect(chunks.some((chunk) => chunk.chunkText.includes("Revision limit: 0"))).toBe(
      true,
    );
    expect(chunks.some((chunk) => chunk.chunkText.includes("Hourly rate: $0/hr"))).toBe(
      true,
    );
  });

  it("splits long scope text into bounded chunks", () => {
    const longScope = `${"A".repeat(1300)}. ${"B".repeat(1300)}.`;
    const chunks = chunkProjectScope({
      original_scope: longScope,
      deliverables: null,
      exclusions: null,
      revision_limit: null,
      hourly_rate: null,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.sourceField === "original_scope")).toBe(
      true,
    );
    expect(chunks.every((chunk) => chunk.chunkText.length <= 1500)).toBe(true);
  });
});
