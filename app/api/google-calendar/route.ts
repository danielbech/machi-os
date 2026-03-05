import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// POST /api/google-calendar — exchange auth code or refresh token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { grant_type } = body;

    if (grant_type === "authorization_code") {
      // Exchange auth code for access + refresh tokens
      const { code, redirect_uri } = body;
      if (!code || !redirect_uri) {
        return NextResponse.json({ error: "Missing code or redirect_uri" }, { status: 400 });
      }

      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Google token exchange error:", data);
        return NextResponse.json(
          { error: data.error_description || "Token exchange failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        expires_in: data.expires_in,
      });
    }

    if (grant_type === "refresh_token") {
      // Refresh an expired access token
      const { refresh_token } = body;
      if (!refresh_token) {
        return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });
      }

      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Google token refresh error:", data);
        return NextResponse.json(
          { error: data.error_description || "Token refresh failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        access_token: data.access_token,
        expires_in: data.expires_in,
      });
    }

    return NextResponse.json({ error: "Invalid grant_type" }, { status: 400 });
  } catch (error) {
    console.error("Google Calendar API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
