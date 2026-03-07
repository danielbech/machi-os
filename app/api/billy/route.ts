import { NextRequest, NextResponse } from "next/server";

const BILLY_BASE = "https://api.billysbilling.com/v2";
const TOKEN = process.env.BILLY_ACCESS_TOKEN;

async function billyFetch(path: string) {
  const res = await fetch(`${BILLY_BASE}${path}`, {
    headers: { "X-Access-Token": TOKEN! },
    next: { revalidate: 300 }, // 5 min cache
  });
  if (!res.ok) {
    throw new Error(`Billy API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: "BILLY_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint param" }, { status: 400 });
  }

  // Whitelist allowed endpoints
  const allowed = ["/organization", "/invoices", "/bills", "/salesTaxReturns", "/accounts"];
  const base = endpoint.split("?")[0];
  if (!allowed.includes(base)) {
    return NextResponse.json({ error: "Endpoint not allowed" }, { status: 403 });
  }

  try {
    const data = await billyFetch(endpoint);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Billy API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
