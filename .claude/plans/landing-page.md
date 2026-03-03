# Landing Page + Route Restructure Plan

## Overview
Move from `app.flowie.co` (app-only) to `flowie.co` (landing page + app). Logged-out visitors see a landing page, logged-in users get redirected to the dashboard.

## Route Changes

| Current | New |
|---------|-----|
| `/` (board) | `/board` |
| `/timeline` | `/timeline` (no change) |
| `/projects` | `/projects` (no change) |
| `/feedback` | `/feedback` (no change) |
| — | `/` (landing page) |
| — | `/home` (always shows landing page, useful for dev) |

## Implementation Steps

### 1. Move board from `/` to `/board`
- Move `app/(dashboard)/page.tsx` → `app/(dashboard)/board/page.tsx`
- Update sidebar links in `components/app-sidebar.tsx`: Board link `/` → `/board`
- Update any other internal links pointing to `/`

### 2. Create landing page
- Create `app/(marketing)/` route group with its own layout (no sidebar, no auth gate)
- `app/(marketing)/page.tsx` — landing page at `/`
- `app/(marketing)/home/page.tsx` — same landing page, always accessible at `/home`
- Simple, clean design: hero section, feature highlights, login CTA
- Use existing Flowie branding (`/logo-mark.svg`, dark theme)

### 3. Add Next.js middleware
- Create `middleware.ts` at project root
- Check Supabase auth session
- If authenticated + hitting `/` → redirect to `/board`
- If not authenticated + hitting dashboard routes → redirect to `/` (or login)
- Leave `/home` unprotected (always shows landing page)

### 4. Update auth flow
- After login/signup, redirect to `/board` instead of `/`
- Check `auth-form.tsx` and any OAuth callback routes for redirect URLs

### 5. External config (manual, not code)
- **Vercel**: Add `flowie.co` as primary domain
- **Supabase Auth**: Update Site URL + redirect URLs from `app.flowie.co` → `flowie.co`
- **Google Cloud Console**: Update authorized origins + redirect URIs
- Keep `app.flowie.co` in allowed lists temporarily during transition

## Notes
- The `(dashboard)` layout already has an auth gate — that stays as-is
- The `(marketing)` layout will be public, no auth required
- Incognito window or `/home` route to preview landing page while logged in
