import { NextRequest, NextResponse } from "next/server";

const BILLY_BASE = "https://api.billysbilling.com/v2";
const TOKEN = process.env.BILLY_ACCESS_TOKEN;

const ALLOWED_ENDPOINTS = ["/organization", "/invoices", "/bills", "/accounts", "/accountNatures", "/postings"];

export async function GET(request: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: "BILLY_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  try {
    // Forward all query params to Billy
    const billyParams = new URLSearchParams();
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "endpoint") {
        billyParams.set(key, value);
      }
    });

    const billyUrl = `${BILLY_BASE}${endpoint}${billyParams.size > 0 ? `?${billyParams}` : ""}`;
    const res = await fetch(billyUrl, {
      headers: { "X-Access-Token": TOKEN },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      throw new Error(`Billy API ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Billy API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
