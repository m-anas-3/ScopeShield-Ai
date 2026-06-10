import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireServerEnv } from "@/lib/env/server";

export function createClient() {
  const {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  } = requireServerEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);

  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Middleware refreshes sessions.
        }
      },
    },
  });
}
