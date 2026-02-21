import { NextRequest, NextResponse } from "next/server";
import { authenticateRoute } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const { supabase, user } = await authenticateRoute(request);

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

    // Resolve user IDs to emails
    const userIds = (memberships || []).map((m) => m.user_id);
    const emailMap: Record<string, string> = {};

    const userResults = await Promise.all(
      userIds.map((id) => admin.auth.admin.getUserById(id))
    );

    for (const result of userResults) {
      if (result.data?.user?.id && result.data.user.email) {
        emailMap[result.data.user.id] = result.data.user.email;
      }
    }

    // Fetch profiles for avatar/display_name
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, display_name, avatar_url, color")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    const members = (memberships || []).map((m) => {
      const profile = profileMap.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        email: emailMap[m.user_id] || null,
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
        color: profile?.color || null,
      };
    });

    return NextResponse.json({ members });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("Workspace members route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
