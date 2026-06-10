import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requireServerEnv } from "@/lib/env/server";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  credits_balance: number;
  credits_reset_at: string | null;
  stripe_customer_id: string | null;
  created_at: string | null;
};

type StripeEventRow = {
  id: string;
  type: string;
  livemode: boolean;
  payload: Json;
  processed_at: string | null;
};

type CreditLedgerEntryRow = {
  id: string;
  user_id: string;
  direction: "credit" | "debit";
  source:
    | "starter"
    | "monthly_free"
    | "purchase"
    | "scope_check"
    | "refund";
  credits: number;
  balance_after: number;
  idempotency_key: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Json;
  created_at: string;
};

type AnalysisRequestRow = {
  id: string;
  user_id: string;
  project_id: string;
  idempotency_key: string;
  request_hash: string;
  status: "processing" | "completed" | "failed";
  scope_check_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type AdminDatabase = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Partial<ProfileRow> & { id: string },
        Partial<ProfileRow>
      >;
      stripe_events: Table<
        StripeEventRow,
        Omit<StripeEventRow, "processed_at"> & { processed_at?: string | null },
        Partial<StripeEventRow>
      >;
      credit_ledger_entries: Table<
        CreditLedgerEntryRow,
        Omit<CreditLedgerEntryRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        Partial<CreditLedgerEntryRow>
      >;
      analysis_requests: Table<
        AnalysisRequestRow,
        Omit<AnalysisRequestRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<AnalysisRequestRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      admin_refund_credits: {
        Args: {
          p_user_id: string;
          p_credits: number;
        };
        Returns: number;
      };
      admin_apply_credit_purchase: {
        Args: {
          p_user_id: string;
          p_checkout_session_id: string;
          p_payment_intent_id: string | null;
          p_price_id: string;
          p_credits: number;
          p_amount_cents: number | null;
          p_currency: string | null;
        };
        Returns: number;
      };
      admin_grant_monthly_free_credits: {
        Args: {
          p_user_id: string;
          p_grant_month?: string | null;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AdminClient = ReturnType<typeof createSupabaseClient<AdminDatabase>>;

let adminClient: AdminClient | null = null;

export function createAdminClient() {
  const {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireServerEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  adminClient ??= createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
