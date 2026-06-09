import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseError = { code?: string; message: string };

interface MockState {
  eventInsertError: SupabaseError | null;
  duplicateProcessedAt: string | null;
  eventInserts: unknown[];
  eventUpdates: unknown[];
  rpcResults: Record<string, { data: unknown; error: SupabaseError | null }>;
}

function makeState(overrides: Partial<MockState> = {}): MockState {
  return {
    eventInsertError: null,
    duplicateProcessedAt: null,
    eventInserts: [],
    eventUpdates: [],
    rpcResults: {},
    ...overrides,
  };
}

function createAdminMock(state: MockState) {
  const rpc = vi.fn((name: string) => {
    const result = state.rpcResults[name] ?? { data: 380, error: null };

    return Promise.resolve(result);
  });

  const from = vi.fn((table: string) => {
    if (table !== "stripe_events") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      insert: vi.fn((row: unknown) => {
        state.eventInserts.push(row);

        return Promise.resolve({ data: null, error: state.eventInsertError });
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { processed_at: state.duplicateProcessedAt },
              error: null,
            }),
          ),
        })),
      })),
      update: vi.fn((values: unknown) => ({
        eq: vi.fn((column: string, value: string) => {
          state.eventUpdates.push({ values, column, value });

          return Promise.resolve({ data: null, error: null });
        }),
      })),
    };
  });

  return { from, rpc };
}

function stripeEvent<T>(
  type: Stripe.Event.Type,
  object: T,
  id = `evt_${type.replaceAll(".", "_")}`,
) {
  return {
    id,
    object: "event",
    api_version: "2025-10-29.clover",
    created: 1781020800,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  } as unknown as Stripe.Event;
}

function creditSession(
  metadata: Record<string, string> = {
    user_id: "user_123",
    checkout_type: "credits",
    price_id: "price_credits80",
    credits: "80",
  },
) {
  return {
    id: "cs_credit_80",
    object: "checkout.session",
    amount_total: 900,
    client_reference_id: "user_123",
    currency: "usd",
    metadata,
    mode: "payment",
    payment_intent: "pi_credit_80",
    payment_status: "paid",
  } as unknown as Stripe.Checkout.Session;
}

async function loadWebhookRoute(event: Stripe.Event, state = makeState()) {
  vi.resetModules();
  vi.stubEnv("STRIPE_CREDITS_80_PRICE_ID", "price_credits80");
  vi.stubEnv("STRIPE_CREDITS_200_PRICE_ID", "price_credits200");

  const admin = createAdminMock(state);
  const constructEvent = vi.fn(() => event);

  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => admin,
  }));
  vi.doMock("@/lib/stripe/server", () => ({
    getStripe: () => ({
      webhooks: { constructEvent },
    }),
    getStripeWebhookSecret: () => "whsec_test",
  }));

  const route = await import("../app/api/stripe/webhook/route");

  return { POST: route.POST, admin, constructEvent, state };
}

function signedRequest(body: string) {
  return new Request("http://localhost/api/stripe/webhook", {
    body,
    headers: { "stripe-signature": "t=1,v1=test" },
    method: "POST",
  });
}

describe("Stripe credit webhook route", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("grants one-time credits from a verified checkout.session.completed webhook", async () => {
    const event = stripeEvent(
      "checkout.session.completed",
      creditSession(),
      "evt_credit_completed",
    );
    const body = JSON.stringify({ id: event.id });
    const { POST, admin, constructEvent, state } = await loadWebhookRoute(event);

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(constructEvent).toHaveBeenCalledWith(
      body,
      "t=1,v1=test",
      "whsec_test",
    );
    expect(admin.rpc).toHaveBeenCalledWith(
      "admin_apply_credit_purchase",
      expect.objectContaining({
        p_amount_cents: 900,
        p_checkout_session_id: "cs_credit_80",
        p_credits: 80,
        p_currency: "usd",
        p_payment_intent_id: "pi_credit_80",
        p_price_id: "price_credits80",
        p_user_id: "user_123",
      }),
    );
    expect(state.eventUpdates).toHaveLength(1);
  });

  it("skips already-processed duplicate webhook events", async () => {
    const state = makeState({
      duplicateProcessedAt: "2026-06-09T12:00:00.000Z",
      eventInsertError: { code: "23505", message: "duplicate key" },
    });
    const event = stripeEvent(
      "checkout.session.completed",
      creditSession(),
      "evt_duplicate",
    );
    const { POST, admin } = await loadWebhookRoute(event, state);

    const response = await POST(signedRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, duplicate: true });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(state.eventUpdates).toHaveLength(0);
  });

  it("fails without applying credits when required checkout metadata is missing", async () => {
    const event = stripeEvent(
      "checkout.session.completed",
      creditSession({}),
      "evt_missing_metadata",
    );
    const { POST, admin, state } = await loadWebhookRoute(event);

    const response = await POST(signedRequest("{}"));

    expect(response.status).toBe(500);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(state.eventUpdates).toHaveLength(0);
  });

  it("fails without applying credits when the checkout price is not configured", async () => {
    const event = stripeEvent(
      "checkout.session.completed",
      creditSession({
        user_id: "user_123",
        checkout_type: "credits",
        price_id: "price_unknown",
        credits: "80",
      }),
      "evt_unknown_price",
    );
    const { POST, admin, state } = await loadWebhookRoute(event);

    const response = await POST(signedRequest("{}"));

    expect(response.status).toBe(500);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(state.eventUpdates).toHaveLength(0);
  });

  it("records but ignores non-credit invoice events", async () => {
    const event = stripeEvent(
      "invoice.paid",
      { id: "in_123", object: "invoice" },
      "evt_invoice_ignored",
    );
    const { POST, admin, state } = await loadWebhookRoute(event);

    const response = await POST(signedRequest("{}"));

    expect(response.status).toBe(200);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(state.eventUpdates).toHaveLength(1);
  });
});
