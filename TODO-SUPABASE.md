# Machi OS - Add Supabase Backend

**Date:** 2026-02-15
**Goal:** Add proper database schema and persistence to Machi OS

## Key Decision: Data Model Design

Need to think through how tasks relate to clients (and possibly projects):

### Options to consider:

**1. Simple (1:1)**
```
task.client_id → client
```
- One task = one client (or none)
- Simplest, but limited

**2. Client → Project → Task**
```
client → project → task
```
- Better for billable work tracking
- Matches agency workflow?

**3. Many-to-Many**
```
task ↔ task_clients ↔ client
```
- Flexible, but can get complex

### Also need:

**Tables:**
- `users` (auth)
- `tasks` (id, title, description, completed, day, etc.)
- `clients` (id, name, color/badge styling)
- `team_members` (Daniel, Casper, Jens, Emil)
- `task_assignees` (many-to-many join table)
- Potentially: `projects`

**Features:**
- User authentication (like Greek Body)
- Real-time sync
- Multi-device access
- Persistent storage (no data loss on refresh)

**Migration path:**
- Set up Supabase project
- Design schema based on Oimachi workflow
- Replace local state with Supabase queries
- Add real-time subscriptions

---

**Before starting:** Decide on the client/project/task relationship based on actual Oimachi workflow.

**Questions to answer:**
- Do tasks usually belong to one client or multiple?
- Do you track projects within clients?
- How do you currently organize billable work?
