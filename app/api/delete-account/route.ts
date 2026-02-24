import { NextRequest, NextResponse } from "next/server";
import { authenticateRoute } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await authenticateRoute(request);
    const admin = createAdminClient();

    // 1. Delete pending invites sent by this user
    await admin
      .from("pending_invites")
      .delete()
      .eq("invited_by", user.id);

    // 2. Find workspaces where user is the sole member → delete them
    const { data: memberships } = await admin
      .from("workspace_memberships")
      .select("project_id")
      .eq("user_id", user.id);

    if (memberships) {
      for (const m of memberships) {
        const { count } = await admin
          .from("workspace_memberships")
          .select("id", { count: "exact", head: true })
          .eq("project_id", m.project_id);

        if (count === 1) {
          await admin.from("projects").delete().eq("id", m.project_id);
        }
      }
    }

    // 3. Delete the auth user (cascades to profiles, memberships, calendar, etc.)
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Failed to delete user:", error);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (thrown) {
    if (thrown instanceof NextResponse) return thrown;
    console.error("Delete account error:", thrown);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
