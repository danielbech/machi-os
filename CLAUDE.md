# Flowie

## Workflow: OnUI Annotations

When the user says **"anno"**, start the annotation workflow:
1. Fetch all pages and annotations from OnUI (`onui_list_pages` → `onui_get_annotations`)
2. Work through each **pending** annotation — read the relevant code, make the fix, commit & push
3. Mark each annotation as resolved after completing it (`onui_update_annotation_metadata` with `status: "resolved"`)
4. Skip any annotations that were already handled in the current session

The operating system for Oimachi — a 2-person digital design & development agency (Daniel & Casper). An internal tool — not a commercial product. Both users share the same single project view.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Language:** TypeScript
- **Database:** Supabase (Postgres + Auth + RLS)
- **Styling:** Tailwind CSS 4, shadcn/ui components
- **Drag & Drop:** dnd-kit
- **Calendar:** Google Calendar API (OAuth, multi-account, synced to Supabase)
- **Deployment:** Vercel (auto-deploys on push to main). Use `dev` branch for bigger features (Vercel creates preview URLs automatically), push small fixes directly to `main`.
- **Package manager:** npm

## Project Structure

```
app/
  layout.tsx              # Root layout (dark theme, Geist fonts)
  (dashboard)/
    layout.tsx            # Dashboard layout — WorkspaceProvider + SidebarProvider + auth gate
    page.tsx              # Kanban board
    clients/page.tsx      # Clients management (add/edit/delete with colors + logos)
  api/
    google-calendar/      # OAuth token exchange
    billy/                # Proxy to Billy accounting API
    feedback/             # Public feedback submission + file upload
    delete-account/       # Account deletion
  auth/callback/          # Google OAuth popup callback
components/
  app-sidebar.tsx         # Collapsible sidebar (icon-only, expands on hover) — nav
  auth-form.tsx           # Login/signup form (Supabase Auth)
  task-edit-dialog.tsx    # Task edit dialog — uses workspace context for clients
  settings-dialog.tsx     # Settings — workspace, board, calendar, theme, about
  ui/                     # shadcn/ui components (kanban, sidebar, dialog, badge, dropdown-menu, etc.)
lib/
  types.ts                # Shared TypeScript types (Task, Member, Client, Project, etc.)
  constants.ts            # Team members, column config
  colors.ts               # Central color system — all palettes, mappings, and helpers (see Color System section)
  workspace-context.tsx   # React context: single project, week mode, board columns (consumed by dashboard pages)
  google-calendar.ts      # Google Calendar OAuth + API helpers (fetchCalendarList, fetchGoogleEmail, etc.)
  supabase/
    client.ts             # Browser Supabase client
    server.ts             # Admin Supabase client (service role key, server-side only)
    calendar.ts           # Calendar connections + events — save, sync, load shared events
    clients.ts            # Client CRUD — load, create, update, delete
    initialize.ts         # First-login setup, getAreaIdForProject
    tasks-simple.ts       # Task CRUD — load, save, delete, reorder (by projectId)
    workspace.ts          # Project settings (name, color, logo)
    database.types.ts     # Auto-generated Supabase types (may be stale — not all tables included)
supabase/
  migrations/             # SQL migrations (run manually in Supabase SQL Editor)
```

## Database Schema

All tables have RLS enabled. Access is controlled via `workspace_memberships`.

```
projects              — id, user_id, name, color
areas                 — id, project_id, name, sort_order
tasks                 — id, area_id, title, description, day, completed, sort_order, assignees (jsonb), client (uuid), priority (text)
team_members          — id, user_id, name, initials, color
clients               — id, project_id, name, slug, color, logo_url, sort_order, active
workspace_memberships — id, project_id, user_id, role (owner/admin/member)
calendar_connections  — id, project_id, user_id, access_token, expires_at, selected_calendars (text[]), google_email, created_at, updated_at
calendar_events       — id, project_id, user_id, connection_id, google_event_id, calendar_id, summary, description, start_time, end_time, location, synced_at
```

Task metadata (assignees, client, priority) is stored in dedicated columns on the tasks table (`assignees jsonb`, `client text`, `priority text`). The `client` column stores the UUID of the client from the `clients` table.

## Key Patterns

- **Single project:** Both users (Daniel & Casper) share a single project. No workspace switcher, no invites, no multi-project logic.
- **Optimistic updates:** Tasks are added to local state with a temp ID (`task-{timestamp}`), saved to Supabase, then the temp ID is swapped for the real UUID.
- **Day-based kanban:** Tasks are grouped by weekday (monday–friday). The `day` column in the DB maps to kanban columns.
- **RLS via workspace_memberships:** All data access goes through Supabase RLS policies. Two `SECURITY DEFINER` helper functions (`get_user_project_ids`, `get_user_admin_project_ids`) prevent infinite recursion in self-referencing policies.
- **Workspace context:** `WorkspaceProvider` in the dashboard layout loads the single project and manages week mode, board columns, and transition schedule. Pages consume via `useWorkspace()`.
- **Sidebar navigation:** Collapsible sidebar (icon-only by default, expands on hover).
- **Google Calendar:** OAuth tokens stored in Supabase `calendar_connections` table (per user, per Google account). Supports multiple Google accounts per user. Events are cached in `calendar_events` and synced every 30 minutes. Both users see each other's events on the board.
- **API routes:** Server routes (`app/api/`) use both authenticated user context (via Supabase SSR client) and admin context (service role) when accessing `auth.users` or bypassing RLS.

## Conventions

- **shadcn/ui first:** Always use shadcn/ui components and blocks as the default before building custom solutions. Use `<Button>` from `components/ui/button`, `<Input>` / `<Textarea>` from `components/ui/input`, `<Dialog>`, `<Badge>`, etc. Only write custom elements when shadcn doesn't cover the use case (e.g., toggle-select buttons, color swatches).
- **Button variants:** `default` = white primary, `ghost` = cancel/subtle, `destructive` = soft red bg, `destructive-ghost` = text-only red. Sizes: `default`, `sm`, `xs`, `icon`, `icon-xs`, `icon-sm`.
- **Accessibility:** Add `aria-label` to all icon-only buttons.
- Keep it simple — minimal abstractions, no over-engineering
- Import shared types from `@/lib/types`, constants from `@/lib/constants`

## Color System

The UI is fully themeable via CSS custom properties. **Never use hardcoded `white` or `black` for semantic colors.**

### Rules

1. **Use `foreground` with opacity, not `white`:**
   - `bg-foreground/[0.02]` not ~~`bg-white/[0.02]`~~ (subtle surfaces)
   - `text-foreground/40` not ~~`text-white/40`~~ (subdued text)
   - `border-foreground/10` not ~~`border-white/10`~~ (borders)
   - `text-foreground` not ~~`text-white`~~ (primary text)
   - Same for `ring-`, `divide-`, etc.
2. **Exception — literal white on colored backgrounds stays `text-white`:** checkmarks inside green circles, member initials on colored avatars, notification badges on `bg-blue-500`, etc. These are always white regardless of theme.
3. **Overlays use `bg-black/50` or `bg-black/80`** — these should be dark in any theme.
4. **shadcn semantic tokens** (`bg-card`, `text-muted-foreground`, `bg-popover`, `border-border`, etc.) are used by shadcn primitives in `components/ui/`. Use these when appropriate.
5. **Project-specific colors** (client colors, status badges, timeline) are centralized in `lib/colors.ts`. All color palettes, mappings, and helpers live there. Never define color maps inline in components.

### `lib/colors.ts` exports

| Export | Purpose |
|---|---|
| `CLIENT_DOT_COLORS` | Color picker swatches (`bg-blue-500`, etc.) |
| `CLIENT_TEXT_COLORS` | Client label text on cards (`text-blue-400`, etc.) |
| `CLIENT_RGB_COLORS` | RGB strings for CSS variables (glow effects) |
| `CLIENT_HEX_COLORS` | Hex values (timeline bars, presence cursors) |
| `BADGE_COLOR_STYLES` | Status badge classes (bg + text + border) |
| `COLOR_NAMES` | Array of all color names in the palette |
| `getClientTextClassName(color)` | Look up text color class, defaults to blue |
| `getBadgeColorStyle(color)` | Look up badge style, defaults to gray |
| `getHexFromTailwind(tw)` | Convert Tailwind bg class to hex |
| `WORKSPACE_COLORS` | Hex array for workspace/member profile swatches |

## Running Locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Required env vars (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

## Migrations

No Supabase CLI — migrations in `supabase/migrations/` are run manually via the Supabase Dashboard SQL Editor. When writing new migrations, add them as numbered files (e.g., `002_add_task_columns.sql`).
