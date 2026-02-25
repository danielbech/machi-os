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

    // Use admin client to look up user by email
    const admin = createAdminClient();
    const { data: targetUserId, error: rpcError } = await admin.rpc("get_user_id_by_email", {
      lookup_email: email,
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
    }

    // Don't invite yourself (check both email and user ID)
    if (email === user.email?.toLowerCase() || targetUserId === user.id) {
      return NextResponse.json({ error: "You're already in this workspace" }, { status: 400 });
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
        return NextResponse.json({ error: "Already a member of this workspace" }, { status: 409 });
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await admin
      .from("pending_invites")
      .select("id")
      .eq("project_id", projectId)
      .eq("email", email)
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json({ error: "Invite already sent to this email" }, { status: 409 });
    }

    // Create pending invite — user will accept/decline from the app
    const { error: inviteError } = await admin
      .from("pending_invites")
      .insert({
        project_id: projectId,
        email,
        role,
        invited_by: user.id,
      });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    return NextResponse.json({ status: "invited", message: "Invite sent" });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("Invite route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
