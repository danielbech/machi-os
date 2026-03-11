import { NextRequest, NextResponse } from "next/server";
import { submitFeedbackItem } from "@/lib/supabase/website-feedback";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, description, submitted_by, media_urls } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (!submitted_by || typeof submitted_by !== "string" || !submitted_by.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const item = await submitFeedbackItem(token, {
      description: description.trim(),
      submitted_by: submitted_by.trim(),
      media_urls: Array.isArray(media_urls) ? media_urls : [],
    });

    if (!item) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err) {
    console.error("Feedback submission error:", err);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
