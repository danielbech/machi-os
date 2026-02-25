import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRoute } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  projectId: z.string().uuid("Invalid project ID"),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email: rawEmail, projectId, role } = parsed.data;
    const email = rawEmail.toLowerCase();

    const { supabase, user } = await authenticateRoute(request);

    // Verify caller is owner or admin of this project
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Not authorized to invite to this project" }, { status: 403 });
    }

    // Don't invite yourself
    if (email === user.email?.toLowerCase()) {
      return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
    }

    // Use admin client to look up user by email
    const admin = createAdminClient();
    const { data: targetUserId, error: rpcError } = await admin.rpc("get_user_id_by_email", {
      lookup_email: email,
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
    }

    if (targetUserId) {
      // User exists — check if already a member
      const { data: existingMembership } = await admin
        .from("workspace_memberships")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json({ error: "User is already a member" }, { status: 409 });
      }

      // Add them directly
      const { error: insertError } = await admin
        .from("workspace_memberships")
        .insert({
          project_id: projectId,
          user_id: targetUserId,
          role,
        });

      if (insertError) {
        console.error("Insert membership error:", insertError);
        return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
      }

      return NextResponse.json({ status: "added", message: "User added to workspace" });
    }

    // User doesn't exist — create pending invite
    const { error: inviteError } = await admin
      .from("pending_invites")
      .upsert(
        {
          project_id: projectId,
          email,
          role,
          invited_by: user.id,
        },
        { onConflict: "project_id,email" }
      );

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    return NextResponse.json({ status: "invited", message: "Invite sent — will be accepted when they sign up" });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("Invite route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
