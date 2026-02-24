import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRoute } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/server";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").transform(s => s.trim()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color").default("#3b82f6"),
});

const deleteWorkspaceSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, color } = parsed.data;

    const { user } = await authenticateRoute(request);
    const admin = createAdminClient();

    // Create project
    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({ name, color, user_id: user.id })
      .select("id, name, color")
      .single();

    if (projectError || !project) {
      console.error("Create project error:", projectError);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    // Create owner membership
    const { error: membershipError } = await admin
      .from("workspace_memberships")
      .insert({ project_id: project.id, user_id: user.id, role: "owner" });

    if (membershipError) {
      console.error("Create membership error:", membershipError);
      await admin.from("projects").delete().eq("id", project.id);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    // Create default "General" area
    const { error: areaError } = await admin
      .from("areas")
      .insert({ project_id: project.id, name: "General", sort_order: 0 });

    if (areaError) {
      console.error("Create area error:", areaError);
      await admin.from("projects").delete().eq("id", project.id);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("Create workspace error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { projectId } = parsed.data;

    const { supabase, user } = await authenticateRoute(request);

    // Verify caller is owner
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can delete a workspace" }, { status: 403 });
    }

    // Verify user has at least 2 workspaces
    const { count } = await supabase
      .from("workspace_memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!count || count < 2) {
      return NextResponse.json({ error: "Cannot delete your last workspace" }, { status: 400 });
    }

    // Delete project (CASCADE handles everything)
    const admin = createAdminClient();
    const { error: deleteError } = await admin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      console.error("Delete project error:", deleteError);
      return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("Delete workspace error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
