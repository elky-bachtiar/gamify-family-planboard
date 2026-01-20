# Gamify Family Planboard (Taskaroo)

A gamified family task management system where family members can create and complete tasks to earn points, level up, earn achievements, and redeem rewards.

**Version:** 1.0.0-alpha

## Features

- **Task Management** - Create, assign, and track family tasks with priorities and due dates
- **Gamification** - Points, levels, streaks, and achievements to motivate task completion
- **Child-Friendly Mobile UI** - Duolingo-style mobile experience for children with PIN login
- **Approval Workflows** - Parents approve completed tasks and child-created tasks
- **Recurring Tasks** - Daily, weekly, or specific day patterns
- **Rewards System** - Children can redeem points for parent-approved rewards
- **Multi-Language** - English and Dutch language support
- **Real-Time Sync** - Live updates across all family members
- **Drag-and-Drop** - Reorder task priorities within each day

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Icons:** Lucide React
- **i18n:** i18next

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=<your-supabase-url>
   VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```
4. Run database migrations in Supabase
5. Deploy edge functions to Supabase

### Development

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

## Project Structure

```
src/
├── components/      # React components
│   ├── Admin/       # Admin panel components
│   ├── Auth/        # Authentication pages
│   ├── Child/       # Child dashboard and gamification
│   └── Rewards/     # Rewards system
├── contexts/        # React context providers
├── hooks/           # Custom React hooks
├── i18n/            # Internationalization
│   └── locales/     # EN and NL translations
├── lib/             # Utilities and Supabase client
└── types/           # TypeScript types

supabase/
├── functions/       # Edge functions
└── migrations/      # Database migrations
```

## License

Private - All rights reserved
