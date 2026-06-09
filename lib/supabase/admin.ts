import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
  plan: "free" | "pro" | "agency";
  credits_balance: number;
  credits_reset_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_price_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  created_at: string | null;
};

type StripeEventRow = {
  id: string;
  type: string;
  livemode: boolean;
  payload: Json;
  processed_at: string | null;
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
      admin_apply_subscription_credit_grant: {
        Args: {
          p_user_id: string;
          p_invoice_id: string;
          p_subscription_id: string;
          p_price_id: string;
          p_plan: "pro" | "agency";
          p_credits: number;
          p_period_end: string | null;
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  adminClient ??= createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
