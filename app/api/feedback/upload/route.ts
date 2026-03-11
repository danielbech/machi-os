import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const BUCKET = "feedback-media";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (supports video)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    // Verify token is valid
    const supabase = createAdminClient();
    const { data: board } = await supabase
      .from("website_feedback_boards")
      .select("id")
      .eq("share_token", token)
      .single();

    if (!board) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Upload file
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${board.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("Feedback upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
