# Machi OS

A custom Kanban-based project management system with enhanced flexibility and workflow optimization.

## Tech Stack

- **Next.js 15** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **Dice UI Kanban** - Drag-and-drop Kanban board
- **@dnd-kit** - Drag-and-drop functionality
- **Supabase** - Backend (PostgreSQL + real-time + auth)

## Features

### Current
- ✅ Drag-and-drop Kanban board
- ✅ Column management (To Do, In Progress, Done)
- ✅ Card management
- ✅ Fully accessible (keyboard navigation + screen readers)

### Planned (from spec)
- [ ] **Board System** - Special-purpose boards
- [ ] **Backlog** - Table-like backlog with folders
- [ ] **Author Management** - Assign people/groups to cards
- [ ] **Card Presets** - Pre-configured templates
- [ ] **Time Registration** - Built-in time tracking
- [ ] **Customer Feedback** - Feedback integration system
- [ ] **Timeline Overview** - Start/end date visualization
- [ ] **Auto-sorting** - Sort by responsibility/author

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your project URL and anon key from: Project Settings → API
3. Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

4. Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Create Database Schema (Coming Soon)

We'll add database migrations for:
- Boards
- Columns
- Cards
- Authors
- Folders
- Card Presets

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
machi-os/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Home page (Kanban demo)
│   └── layout.tsx         # Root layout
├── components/
│   └── ui/
│       └── kanban.tsx     # Dice UI Kanban component
├── lib/
│   ├── supabase/
│   │   └── client.ts      # Supabase client
│   ├── compose-refs.ts    # Ref composition utility
│   └── utils.ts           # shadcn/ui utilities
└── README.md
```

## Development Roadmap

### Phase 1: Core Kanban (✅ Current)
- [x] Basic Kanban board with drag-and-drop
- [x] Column management
- [x] Card creation/deletion
- [ ] Supabase integration

### Phase 2: Author & Organization
- [ ] Author management (people + groups)
- [ ] Number-based shortcuts for authors
- [ ] Backlog with folder structure
- [ ] Table-like backlog view

### Phase 3: Enhancements
- [ ] Card presets system
- [ ] Time registration
- [ ] Timeline/Gantt view
- [ ] Auto-sorting by responsibility

### Phase 4: Feedback & Polish
- [ ] Customer feedback integration
- [ ] Advanced filtering
- [ ] Search functionality
- [ ] Performance optimization

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Manual

```bash
npm run build
npm start
```

## Documentation

- [Product Specification](https://www.notion.so/Product-Specification-v1-0-3067dc9ed1dc8142bceed13bc2e627c1)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Dice UI Kanban](https://www.diceui.com/docs/components/kanban)
- [@dnd-kit Docs](https://docs.dndkit.com/)

## License

MIT
