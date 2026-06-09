import { NextResponse } from "next/server";

import {
  BILLING_SCHEMA_MISSING_MESSAGE,
  isMissingBillingSchemaError,
  stripeSetupIssues,
} from "@/lib/billing/setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl, getStripe } from "@/lib/stripe/server";

export async function POST() {
  try {
    const setupIssues = stripeSetupIssues();

    if (setupIssues.length > 0) {
      return NextResponse.json(
        { error: setupIssues.join(" ") },
        { status: 503 },
      );
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      if (isMissingBillingSchemaError(profileError)) {
        return NextResponse.json(
          { error: BILLING_SCHEMA_MISSING_MESSAGE },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: "No Stripe customer found." },
        { status: 404 },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppUrl()}/usage`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal failed", error);
    return NextResponse.json(
      { error: "Unable to open billing portal." },
      { status: 500 },
    );
  }
}
