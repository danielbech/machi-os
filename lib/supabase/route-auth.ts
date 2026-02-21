import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

/**
 * Create an authenticated Supabase client from API route request cookies.
 * Returns the client, authenticated user, and a response object for cookie writes.
 * Throws a NextResponse with 401 if not authenticated.
 */
export async function authenticateRoute(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { supabase, user: user as User, response };
}
