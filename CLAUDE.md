# Machi OS

The operating system for Oimachi — a 2-person digital design & development agency (Daniel & Casper). Started as a weekly kanban board to replace Trello, growing into the central hub for projects, clients, team tasks, AI agent work, and client-facing status views.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Language:** TypeScript
- **Database:** Supabase (Postgres + Auth + RLS)
- **Styling:** Tailwind CSS 4, shadcn/ui components
- **Drag & Drop:** dnd-kit
- **Calendar:** Google Calendar API (OAuth, client-side)
- **Deployment:** Vercel (auto-deploys on push to main)
- **Package manager:** npm

## Project Structure

```
app/
  page.tsx              # Main app — kanban board, all core state and logic
  layout.tsx            # Root layout (dark theme, Geist fonts)
  auth/callback/        # Google OAuth popup callback
components/
  auth-form.tsx         # Login/signup form (Supabase Auth)
  ui/                   # shadcn/ui components (kanban, dialog, badge, etc.)
lib/
  types.ts              # Shared TypeScript types (Task, Member, Client)
  constants.ts          # Team members, clients, column config
  google-calendar.ts    # Google Calendar OAuth + API helpers
  supabase/
    client.ts           # Browser Supabase client
    initialize.ts       # First-login setup (project, area, team members)
    tasks-simple.ts     # Task CRUD — load, save, delete, reorder
    workspace.ts        # Workspace membership management
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
```

Task metadata (assignees, client, priority) is stored in dedicated columns on the tasks table (`assignees jsonb`, `client text`, `priority text`).

## Key Patterns

- **Optimistic updates:** Tasks are added to local state with a temp ID (`task-{timestamp}`), saved to Supabase, then the temp ID is swapped for the real UUID.
- **Day-based kanban:** Tasks are grouped by weekday (monday–friday). The `day` column in the DB maps to kanban columns.
- **RLS via workspace_memberships:** All data access goes through Supabase RLS policies. Two `SECURITY DEFINER` helper functions (`get_user_project_ids`, `get_user_admin_project_ids`) prevent infinite recursion in self-referencing policies.
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
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

## Migrations

No Supabase CLI — migrations in `supabase/migrations/` are run manually via the Supabase Dashboard SQL Editor. When writing new migrations, add them as numbered files (e.g., `002_add_task_columns.sql`).
