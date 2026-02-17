import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // Authenticate caller
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is a member of this workspace
    const { data: callerMembership } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerMembership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    // Fetch memberships
    const admin = createAdminClient();
    const { data: memberships, error: memberError } = await admin
      .from("workspace_memberships")
      .select("id, user_id, role, created_at")
      .eq("project_id", projectId)
      .order("created_at");

    if (memberError) {
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }

    // Resolve user IDs to emails via auth.admin
    const userIds = (memberships || []).map((m) => m.user_id);
    const emailMap: Record<string, string> = {};

    // Supabase admin API: list users and filter
    // For small teams this is fine — fetch all and match
    const { data: { users }, error: usersError } = await admin.auth.admin.listUsers({
      perPage: 100,
    });

    if (!usersError && users) {
      for (const u of users) {
        if (userIds.includes(u.id) && u.email) {
          emailMap[u.id] = u.email;
        }
      }
    }

    const members = (memberships || []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      email: emailMap[m.user_id] || null,
    }));

    return NextResponse.json({ members });
  } catch (err) {
    console.error("Workspace members route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
