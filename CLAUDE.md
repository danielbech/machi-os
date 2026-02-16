# Machi OS

The operating system for Oimachi — a 2-person digital design & development agency (Daniel & Casper). Started as a weekly kanban board to replace Trello, growing into the central hub for projects, clients, team tasks, AI agent work, and client-facing status views.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Language:** TypeScript
- **Database:** Supabase (Postgres + Auth + RLS)
- **Styling:** Tailwind CSS 4, shadcn/ui components
- **Drag & Drop:** dnd-kit
- **Calendar:** Google Calendar API (OAuth, client-side)
- **Deployment:** Vercel (auto-deploys on push to main). Always push to main after completing work — no PRs needed.
- **Package manager:** npm

## Project Structure

```
app/
  page.tsx              # Main app — kanban board, workspace switcher, all core state
  layout.tsx            # Root layout (dark theme, Geist fonts)
  api/invite/route.ts   # POST — invite user by email (service role for auth.users lookup)
  auth/callback/        # Google OAuth popup callback
components/
  auth-form.tsx         # Login/signup form (Supabase Auth)
  settings-dialog.tsx   # Settings — integrations, invite members, pending invites
  ui/                   # shadcn/ui components (kanban, dialog, badge, dropdown-menu, etc.)
lib/
  types.ts              # Shared TypeScript types (Task, Member, Client, Project, PendingInvite)
  constants.ts          # Team members, clients, column config
  google-calendar.ts    # Google Calendar OAuth + API helpers
  supabase/
    client.ts           # Browser Supabase client
    server.ts           # Admin Supabase client (service role key, server-side only)
    initialize.ts       # First-login setup, getAreaIdForProject, accept pending invites
    tasks-simple.ts     # Task CRUD — load, save, delete, reorder (by projectId)
    workspace.ts        # Workspace list, members, pending invites, roles
    database.types.ts   # Auto-generated Supabase types
supabase/
  migrations/           # SQL migrations (run manually in Supabase SQL Editor)
```

## Database Schema

All tables have RLS enabled. Access is controlled via `workspace_memberships`.

```
projects         — id, user_id, name, color
areas            — id, project_id, name, sort_order
tasks            — id, area_id, title, description, day, completed, sort_order
team_members     — id, user_id, name, initials, color
workspace_memberships — id, project_id, user_id, role (owner/admin/member)
pending_invites  — id, project_id, email, role, invited_by, created_at
```

Task metadata (assignees, client, priority) is stored in dedicated columns on the tasks table (`assignees jsonb`, `client text`, `priority text`).

## Key Patterns

- **Optimistic updates:** Tasks are added to local state with a temp ID (`task-{timestamp}`), saved to Supabase, then the temp ID is swapped for the real UUID.
- **Day-based kanban:** Tasks are grouped by weekday (monday–friday). The `day` column in the DB maps to kanban columns.
- **RLS via workspace_memberships:** All data access goes through Supabase RLS policies. Two `SECURITY DEFINER` helper functions (`get_user_project_ids`, `get_user_admin_project_ids`) prevent infinite recursion in self-referencing policies.
- **Multi-workspace:** Users can belong to multiple workspaces. The UI shows a workspace switcher (dropdown) when 2+ workspaces exist. Active project is persisted in localStorage.
- **Invite system:** Admins/owners invite by email via `/api/invite`. If user exists, they're added directly. Otherwise a `pending_invite` is created and auto-accepted on next login via `accept_pending_invites()` RPC.
- **Google Calendar:** OAuth tokens stored in localStorage. Events are fetched client-side and displayed as read-only cards above tasks in each day column.

## Conventions

- Use shadcn/ui components from `components/ui/` — don't build custom UI primitives
- Keep it simple — minimal abstractions, no over-engineering
- Dark theme throughout (bg-black/50, white/opacity text)
- Import shared types from `@/lib/types`, constants from `@/lib/constants`

## Running Locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Required env vars (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only — needed for invite API)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

## Migrations

No Supabase CLI — migrations in `supabase/migrations/` are run manually via the Supabase Dashboard SQL Editor. When writing new migrations, add them as numbered files (e.g., `002_add_task_columns.sql`).
