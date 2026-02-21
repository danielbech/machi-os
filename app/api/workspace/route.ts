import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { name, color } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Auth check via cookies
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

    const admin = createAdminClient();

    // Create project
    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({ name: name.trim(), color: color || "#3b82f6", user_id: user.id })
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
      // Rollback: delete project
      await admin.from("projects").delete().eq("id", project.id);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    // Create default "General" area
    const { error: areaError } = await admin
      .from("areas")
      .insert({ project_id: project.id, name: "General", sort_order: 0 });

    if (areaError) {
      console.error("Create area error:", areaError);
      // Rollback: delete project (CASCADE handles membership)
      await admin.from("projects").delete().eq("id", project.id);
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error("Create workspace error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // Auth check via cookies
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
    console.error("Delete workspace error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
