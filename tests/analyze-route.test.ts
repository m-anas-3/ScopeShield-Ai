import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const scopeCheckId = "33333333-3333-4333-8333-333333333333";
const analysisRequestId = "44444444-4444-4444-8444-444444444444";

type SupabaseError = { code?: string; message: string };

interface MockState {
  creditResult: unknown;
  openAIError: Error | null;
  adminRpcCalls: Array<{ name: string; args: unknown }>;
  analysisUpdates: unknown[];
}

function makeState(overrides: Partial<MockState> = {}): MockState {
  return {
    creditResult: [
      {
        success: true,
        credits_balance: 22,
        reason: null,
      },
    ],
    openAIError: null,
    adminRpcCalls: [],
    analysisUpdates: [],
    ...overrides,
  };
}

function createProjectRow() {
  return {
    id: projectId,
    user_id: userId,
    name: "Website rebuild",
    client_name: "Acme",
    original_scope: "Build the agreed landing page.",
    deliverables: "Landing page",
    exclusions: "No ecommerce",
    revision_limit: 2,
    hourly_rate: 100,
    scope_locked: true,
    scope_chunks_count: 1,
  };
}

function createSupabaseMock(state: MockState) {
  const rpc = vi.fn((name: string) => {
    if (name === "consume_credits") {
      return Promise.resolve({ data: state.creditResult, error: null });
    }

    if (name === "match_scope_chunks") {
      return Promise.resolve({
        data: [
          {
            id: "clause_1",
            project_id: projectId,
            chunk_index: 0,
            source_field: "original_scope",
            chunk_text: "Build the agreed landing page.",
            similarity: 0.91,
          },
        ],
        error: null,
      });
    }

    throw new Error(`Unexpected user RPC: ${name}`);
  });

  const from = vi.fn((table: string) => {
    if (table === "projects") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: createProjectRow(), error: null }),
              ),
            })),
          })),
        })),
      };
    }

    if (table === "scope_checks") {
      return {
        insert: vi.fn((row: unknown) => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: scopeCheckId, ...(row as object) },
                error: null,
              }),
            ),
          })),
        })),
      };
    }

    if (table === "usage_logs") {
      return {
        insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }

    throw new Error(`Unexpected user table: ${table}`);
  });

  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: userId, email: "user@example.com" } },
          error: null,
        }),
      ),
    },
    from,
    rpc,
  };
}

function createAdminMock(state: MockState) {
  const rpc = vi.fn((name: string, args: unknown) => {
    state.adminRpcCalls.push({ name, args });
    return Promise.resolve({ data: 30, error: null });
  });

  const from = vi.fn((table: string) => {
    if (table !== "analysis_requests") {
      throw new Error(`Unexpected admin table: ${table}`);
    }

    return {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: analysisRequestId,
                request_hash: "hash",
                status: "processing",
                scope_check_id: null,
                error: null,
              },
              error: null as SupabaseError | null,
            }),
          ),
        })),
      })),
      update: vi.fn((values: unknown) => ({
        eq: vi.fn(() => {
          state.analysisUpdates.push(values);
          return Promise.resolve({ data: null, error: null });
        }),
      })),
    };
  });

  return { from, rpc };
}

async function loadAnalyzeRoute(state = makeState()) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.local");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service_test");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("RATE_LIMIT_ANALYZE_PER_MINUTE", "20");

  const supabase = createSupabaseMock(state);
  const admin = createAdminMock(state);
  const chatCreate = vi.fn(() => {
    if (state.openAIError) {
      return Promise.reject(state.openAIError);
    }

    return Promise.resolve({
      choices: [
        {
          message: {
            content: JSON.stringify({
              scope_status: "in_scope",
              risk_level: "low",
              estimated_hours_min: 0,
              estimated_hours_max: 0,
              ai_reason: "Covered by the retrieved clause.",
              suggested_action: "Proceed as planned.",
              professional_reply:
                "Thanks for the request. This is covered by the current scope. I can proceed with it as planned.",
              change_request_summary: "No change request needed.",
              matched_clause_ids: ["clause_1"],
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
    });
  });
  const embedText = vi.fn(() =>
    Promise.resolve({
      embedding: Array.from({ length: 1536 }, () => 0),
      model: "text-embedding-3-small",
      tokenCount: 10,
    }),
  );

  vi.doMock("@/lib/supabase/server", () => ({
    createClient: () => supabase,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => admin,
  }));
  vi.doMock("@/lib/ai/openai", () => ({
    default: () => ({
      chat: {
        completions: {
          create: chatCreate,
        },
      },
    }),
    ANALYSIS_MODEL: "gpt-test",
  }));
  vi.doMock("@/lib/rag/embeddings", () => ({
    embedText,
  }));

  const route = await import("../app/api/analyze/route");

  return { POST: route.POST, supabase, admin, chatCreate, embedText, state };
}

function analyzeRequest(idempotencyKey = "analysis-test-key") {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      project_id: projectId,
      client_request:
        "The client is asking us to build the same landing page already listed in scope.",
      urgency: "medium",
      client_tone: "friendly",
      extra_notes: "No extra constraints.",
    }),
  });
}

describe("analyze route reliability", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns 402 and does not call OpenAI when the user lacks credits", async () => {
    const state = makeState({
      creditResult: [
        {
          success: false,
          credits_balance: 4,
          reason: "insufficient_credits",
        },
      ],
    });
    const { POST, chatCreate, embedText } = await loadAnalyzeRoute(state);

    const response = await POST(analyzeRequest());
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toEqual({
      error: "Insufficient credits",
      credits_remaining: 4,
    });
    expect(embedText).not.toHaveBeenCalled();
    expect(chatCreate).not.toHaveBeenCalled();
    expect(state.analysisUpdates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        error: "insufficient_credits",
      }),
    );
  });

  it("refunds credits when AI analysis fails after credit consumption", async () => {
    const state = makeState({
      openAIError: new Error("model unavailable"),
    });
    const { POST, chatCreate } = await loadAnalyzeRoute(state);

    const response = await POST(analyzeRequest());

    expect(response.status).toBe(500);
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(state.adminRpcCalls).toContainEqual({
      name: "admin_refund_credits",
      args: {
        p_user_id: userId,
        p_credits: 8,
      },
    });
    expect(state.analysisUpdates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        error: "model unavailable",
      }),
    );
  });
});
