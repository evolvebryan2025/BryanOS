# SOPFlix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Netflix-style SaaS platform where enterprises upload walkthrough videos and get AI-generated SOPs.

**Architecture:** Next.js 14+ App Router with Supabase for auth/database/storage. AI pipeline uses Deepgram for transcription, Claude API for SOP generation, and NanoBanana for thumbnails. PayPal for subscriptions. Multi-tenant via workspace-scoped RLS.

**Tech Stack:** Next.js 14+, Supabase, Claude API, Deepgram, NanoBanana, PayPal Subscriptions API, Tailwind CSS, Vercel

**Design Doc:** `docs/plans/2026-03-02-sopflix-design.md`

---

## Project Structure

```
sopflix/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                    # Landing page
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── pricing/page.tsx
│   │   ├── (app)/
│   │   │   └── app/
│   │   │       ├── layout.tsx              # Auth-protected layout
│   │   │       ├── browse/page.tsx
│   │   │       ├── watch/[id]/page.tsx
│   │   │       ├── library/page.tsx
│   │   │       ├── upload/page.tsx
│   │   │       └── admin/
│   │   │           ├── page.tsx
│   │   │           ├── team/page.tsx
│   │   │           └── billing/page.tsx
│   │   ├── api/
│   │   │   ├── webhooks/paypal/route.ts
│   │   │   ├── ai/transcribe/route.ts
│   │   │   ├── ai/generate-sop/route.ts
│   │   │   └── ai/generate-thumbnail/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser client
│   │   │   ├── server.ts                   # Server client
│   │   │   ├── middleware.ts               # Auth middleware
│   │   │   └── types.ts                    # Generated DB types
│   │   ├── ai/
│   │   │   ├── transcribe.ts              # Deepgram integration
│   │   │   ├── generate-sop.ts            # Claude API integration
│   │   │   └── generate-thumbnail.ts      # NanoBanana integration
│   │   ├── paypal/
│   │   │   ├── client.ts                  # PayPal SDK setup
│   │   │   └── webhooks.ts               # Webhook handlers
│   │   └── utils/
│   │       ├── tier-limits.ts             # Plan limit constants + checks
│   │       └── video-sources.ts           # YouTube/Loom/Vimeo URL parsing
│   ├── components/
│   │   ├── ui/                            # Shared UI (buttons, modals, etc.)
│   │   ├── browse/                        # Netflix carousel components
│   │   ├── watch/                         # Video player + SOP viewer
│   │   ├── upload/                        # Upload form + progress
│   │   └── admin/                         # Admin panel components
│   └── hooks/
│       ├── use-workspace.ts               # Current workspace context
│       └── use-watch-progress.ts          # Video progress tracking
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_functions.sql
├── __tests__/
│   ├── lib/
│   └── components/
├── .env.local.example
├── middleware.ts                           # Next.js middleware for auth
├── next.config.js
├── tailwind.config.ts
├── jest.config.ts
└── package.json
```

---

## Phase 1: Foundation + AI Engine

### Task 1: Project Scaffolding

**Files:**
- Create: `sopflix/package.json`
- Create: `sopflix/next.config.js`
- Create: `sopflix/tailwind.config.ts`
- Create: `sopflix/.env.local.example`
- Create: `sopflix/tsconfig.json`

**Step 1: Create the new project directory and initialize Next.js**

```bash
cd c:\Users\User\Downloads
npx create-next-app@latest sopflix --typescript --tailwind --eslint --app --src-dir --use-npm
```

**Step 2: Install core dependencies**

```bash
cd sopflix
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D jest @testing-library/react @testing-library/jest-dom ts-jest @types/jest jest-environment-jsdom
```

**Step 3: Create `.env.local.example`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
ANTHROPIC_API_KEY=your_anthropic_key
DEEPGRAM_API_KEY=your_deepgram_key
NANOBANANA_API_KEY=your_nanobanana_key

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 4: Create Jest config**

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

**Step 5: Verify project runs**

```bash
npm run dev
# Expected: Next.js dev server starts on localhost:3000
```

**Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold SOPFlix Next.js project with Supabase + Tailwind"
```

---

### Task 2: Supabase Database Schema

**Files:**
- Create: `sopflix/supabase/migrations/001_initial_schema.sql`

**Step 1: Write the complete database migration**

```sql
-- 001_initial_schema.sql

-- Enums
CREATE TYPE workspace_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'contributor', 'viewer');
CREATE TYPE video_source AS ENUM ('youtube', 'loom', 'vimeo', 'cloudflare', 'upload');
CREATE TYPE video_status AS ENUM ('draft', 'processing', 'ready_for_review', 'published');
CREATE TYPE thumbnail_source AS ENUM ('generated', 'custom');

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plan workspace_plan NOT NULL DEFAULT 'free',
  paypal_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace membership
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'viewer',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

-- Video categories per workspace
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Videos
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  thumbnail_source thumbnail_source DEFAULT 'generated',
  thumbnail_prompt TEXT,
  video_url TEXT NOT NULL,
  video_source video_source NOT NULL,
  duration_seconds INT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  status video_status NOT NULL DEFAULT 'draft',
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOPs (1:1 with videos)
CREATE TABLE sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID UNIQUE NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content JSONB,
  transcript TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Watch progress per user per video
CREATE TABLE watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  progress_pct REAL NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  paypal_subscription_id TEXT,
  paypal_plan_id TEXT,
  plan workspace_plan NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage tracking per billing period
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sop_generations INT NOT NULL DEFAULT 0,
  transcribe_minutes REAL NOT NULL DEFAULT 0,
  thumbnail_generations INT NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, period_start)
);

-- Indexes
CREATE INDEX idx_members_workspace ON members(workspace_id);
CREATE INDEX idx_members_user ON members(user_id);
CREATE INDEX idx_videos_workspace ON videos(workspace_id);
CREATE INDEX idx_videos_category ON videos(category_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_sops_video ON sops(video_id);
CREATE INDEX idx_watch_progress_user ON watch_progress(user_id);
CREATE INDEX idx_categories_workspace ON categories(workspace_id);
```

**Step 2: Apply migration to Supabase**

```bash
# Via Supabase dashboard: SQL Editor → paste and run
# Or via CLI:
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with all tables and indexes"
```

---

### Task 3: Row-Level Security Policies

**Files:**
- Create: `sopflix/supabase/migrations/002_rls_policies.sql`

**Step 1: Write RLS policies for workspace isolation**

```sql
-- 002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Helper: get workspace IDs for current user
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check user role in workspace
CREATE OR REPLACE FUNCTION has_workspace_role(ws_id UUID, required_role member_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
      AND workspace_id = ws_id
      AND role <= required_role
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users: can read own profile, update own profile
CREATE POLICY "users_read_own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (id = auth.uid());

-- Members: can read members in same workspace
CREATE POLICY "members_read" ON members FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "members_insert" ON members FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "members_delete" ON members FOR DELETE
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Workspaces: can read workspaces you belong to
CREATE POLICY "workspaces_read" ON workspaces FOR SELECT
  USING (id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "workspaces_update" ON workspaces FOR UPDATE
  USING (id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT
  WITH CHECK (true);

-- Categories: workspace-scoped
CREATE POLICY "categories_read" ON categories FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "categories_write" ON categories FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Videos: workspace-scoped
CREATE POLICY "videos_read" ON videos FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "videos_write" ON videos FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "videos_update" ON videos FOR UPDATE
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "videos_delete" ON videos FOR DELETE
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- SOPs: workspace-scoped
CREATE POLICY "sops_read" ON sops FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "sops_write" ON sops FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
CREATE POLICY "sops_update" ON sops FOR UPDATE
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Watch progress: user-scoped
CREATE POLICY "progress_read" ON watch_progress FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "progress_write" ON watch_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update" ON watch_progress FOR UPDATE
  USING (user_id = auth.uid());

-- Subscriptions: workspace-scoped
CREATE POLICY "subscriptions_read" ON subscriptions FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Usage tracking: workspace-scoped
CREATE POLICY "usage_read" ON usage_tracking FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
```

**Step 2: Apply to Supabase and commit**

```bash
npx supabase db push
git add supabase/
git commit -m "feat: add RLS policies for workspace-scoped data isolation"
```

---

### Task 4: Supabase Client Setup

**Files:**
- Create: `sopflix/src/lib/supabase/client.ts`
- Create: `sopflix/src/lib/supabase/server.ts`
- Create: `sopflix/src/lib/supabase/types.ts`
- Create: `sopflix/middleware.ts`

**Step 1: Generate Supabase types**

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
```

**Step 2: Create browser client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Step 4: Create auth middleware**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from /app routes
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/app/browse'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/app/:path*', '/login', '/signup'],
}
```

**Step 5: Commit**

```bash
git add src/lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client setup with auth middleware"
```

---

### Task 5: Auth Pages (Login + Signup + Workspace Creation)

**Files:**
- Create: `sopflix/src/app/(public)/login/page.tsx`
- Create: `sopflix/src/app/(public)/signup/page.tsx`
- Create: `sopflix/src/app/(public)/layout.tsx`

**Step 1: Create public layout**

```tsx
// src/app/(public)/layout.tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      {children}
    </div>
  )
}
```

**Step 2: Create login page**

```tsx
// src/app/(public)/login/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/app/browse')
    }
  }

  return (
    <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl">
      <h1 className="text-3xl font-bold mb-2">SOPFlix</h1>
      <p className="text-gray-400 mb-6">Sign in to your workspace</p>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700" required />
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700" required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full p-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="mt-4 text-center text-gray-400">
        No account? <a href="/signup" className="text-red-400 hover:underline">Create workspace</a>
      </p>
    </div>
  )
}
```

**Step 3: Create signup page with workspace creation**

```tsx
// src/app/(public)/signup/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    })
    if (authError) { setError(authError.message); setLoading(false); return }

    const userId = authData.user?.id
    if (!userId) { setError('Signup failed'); setLoading(false); return }

    // 2. Create user profile
    await supabase.from('users').insert({ id: userId, email, name })

    // 3. Create workspace
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces').insert({ name: workspaceName, slug }).select().single()
    if (wsError) { setError(wsError.message); setLoading(false); return }

    // 4. Add user as owner
    await supabase.from('members').insert({
      user_id: userId, workspace_id: workspace.id, role: 'owner'
    })

    // 5. Create free subscription
    await supabase.from('subscriptions').insert({
      workspace_id: workspace.id, plan: 'free', status: 'active'
    })

    router.push('/app/browse')
  }

  return (
    <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl">
      <h1 className="text-3xl font-bold mb-2">Create your workspace</h1>
      <p className="text-gray-400 mb-6">Start your SOPFlix free plan</p>
      <form onSubmit={handleSignup} className="space-y-4">
        <input type="text" placeholder="Your name" value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700" required />
        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700" required />
        <input type="password" placeholder="Password (min 8 chars)" value={password}
          onChange={e => setPassword(e.target.value)} minLength={8}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700" required />
        <input type="text" placeholder="Workspace name (e.g. Acme Corp)" value={workspaceName}
          onChange={e => setWorkspaceName(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700" required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full p-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Workspace'}
        </button>
      </form>
      <p className="mt-4 text-center text-gray-400">
        Have an account? <a href="/login" className="text-red-400 hover:underline">Sign in</a>
      </p>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: add login and signup pages with workspace creation"
```

---

### Task 6: Workspace Context Hook

**Files:**
- Create: `sopflix/src/hooks/use-workspace.ts`
- Create: `sopflix/src/app/(app)/app/layout.tsx`

**Step 1: Create workspace hook**

```typescript
// src/hooks/use-workspace.ts
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type Workspace = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
}

type Member = {
  role: string
  workspace_id: string
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get first workspace membership
      const { data: member } = await supabase
        .from('members')
        .select('role, workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!member) { setLoading(false); return }

      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', member.workspace_id)
        .single()

      setWorkspace(ws)
      setRole(member.role)
      setLoading(false)
    }
    load()
  }, [])

  return { workspace, role, loading }
}
```

**Step 2: Create authenticated app layout with sidebar**

```tsx
// src/app/(app)/app/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <nav className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
        <h1 className="text-xl font-bold text-red-500 mb-6">SOPFlix</h1>
        <a href="/app/browse" className="p-2 rounded hover:bg-gray-800">Browse</a>
        <a href="/app/library" className="p-2 rounded hover:bg-gray-800">Library</a>
        <a href="/app/upload" className="p-2 rounded hover:bg-gray-800">Upload</a>
        <div className="mt-auto">
          <a href="/app/admin" className="p-2 rounded hover:bg-gray-800 text-gray-400">Admin</a>
        </div>
      </nav>
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/hooks/ src/app/
git commit -m "feat: add workspace context hook and authenticated app layout"
```

---

### Task 7: Video Source URL Parser

**Files:**
- Create: `sopflix/src/lib/utils/video-sources.ts`
- Create: `sopflix/__tests__/lib/video-sources.test.ts`

**Step 1: Write the failing tests**

```typescript
// __tests__/lib/video-sources.test.ts
import { parseVideoUrl, getEmbedUrl } from '@/lib/utils/video-sources'

describe('parseVideoUrl', () => {
  it('parses YouTube watch URLs', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result).toEqual({ source: 'youtube', videoId: 'dQw4w9WgXcQ' })
  })

  it('parses YouTube short URLs', () => {
    const result = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(result).toEqual({ source: 'youtube', videoId: 'dQw4w9WgXcQ' })
  })

  it('parses Loom URLs', () => {
    const result = parseVideoUrl('https://www.loom.com/share/abc123def456')
    expect(result).toEqual({ source: 'loom', videoId: 'abc123def456' })
  })

  it('parses Vimeo URLs', () => {
    const result = parseVideoUrl('https://vimeo.com/123456789')
    expect(result).toEqual({ source: 'vimeo', videoId: '123456789' })
  })

  it('returns null for unsupported URLs', () => {
    const result = parseVideoUrl('https://example.com/video')
    expect(result).toBeNull()
  })
})

describe('getEmbedUrl', () => {
  it('generates YouTube embed URL', () => {
    expect(getEmbedUrl('youtube', 'dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('generates Loom embed URL', () => {
    expect(getEmbedUrl('loom', 'abc123'))
      .toBe('https://www.loom.com/embed/abc123')
  })

  it('generates Vimeo embed URL', () => {
    expect(getEmbedUrl('vimeo', '123456'))
      .toBe('https://player.vimeo.com/video/123456')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/video-sources.test.ts
# Expected: FAIL — module not found
```

**Step 3: Write implementation**

```typescript
// src/lib/utils/video-sources.ts
type ParsedVideo = {
  source: 'youtube' | 'loom' | 'vimeo'
  videoId: string
}

export function parseVideoUrl(url: string): ParsedVideo | null {
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { source: 'youtube', videoId: ytMatch[1] }

  // Loom: loom.com/share/ID
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (loomMatch) return { source: 'loom', videoId: loomMatch[1] }

  // Vimeo: vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { source: 'vimeo', videoId: vimeoMatch[1] }

  return null
}

export function getEmbedUrl(source: string, videoId: string): string {
  switch (source) {
    case 'youtube': return `https://www.youtube.com/embed/${videoId}`
    case 'loom': return `https://www.loom.com/embed/${videoId}`
    case 'vimeo': return `https://player.vimeo.com/video/${videoId}`
    default: return ''
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/video-sources.test.ts
# Expected: PASS — all 6 tests pass
```

**Step 5: Commit**

```bash
git add src/lib/utils/ __tests__/
git commit -m "feat: add video URL parser with YouTube/Loom/Vimeo support"
```

---

### Task 8: Tier Limits Utility

**Files:**
- Create: `sopflix/src/lib/utils/tier-limits.ts`
- Create: `sopflix/__tests__/lib/tier-limits.test.ts`

**Step 1: Write failing tests**

```typescript
// __tests__/lib/tier-limits.test.ts
import { TIER_LIMITS, isWithinLimit } from '@/lib/utils/tier-limits'

describe('TIER_LIMITS', () => {
  it('has correct free tier limits', () => {
    expect(TIER_LIMITS.free.maxMembers).toBe(3)
    expect(TIER_LIMITS.free.maxVideos).toBe(10)
    expect(TIER_LIMITS.free.sopGenerationsPerMonth).toBe(3)
  })

  it('enterprise tier has Infinity for unlimited', () => {
    expect(TIER_LIMITS.enterprise.maxMembers).toBe(Infinity)
    expect(TIER_LIMITS.enterprise.maxVideos).toBe(Infinity)
  })
})

describe('isWithinLimit', () => {
  it('returns true when under limit', () => {
    expect(isWithinLimit(2, 3)).toBe(true)
  })

  it('returns false when at limit', () => {
    expect(isWithinLimit(3, 3)).toBe(false)
  })

  it('returns true for Infinity limit', () => {
    expect(isWithinLimit(999999, Infinity)).toBe(true)
  })
})
```

**Step 2: Run to verify failure, then implement**

```typescript
// src/lib/utils/tier-limits.ts
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise'

type TierLimit = {
  maxMembers: number
  maxVideos: number
  maxStorageBytes: number
  maxCategories: number
  sopGenerationsPerMonth: number
  transcribeMinutesPerMonth: number
  thumbnailGenerationsPerMonth: number
  customBranding: boolean
  exportPdf: boolean
  importTools: boolean
  fullAnalytics: boolean
  apiAccess: boolean
  ssoSaml: boolean
}

export const TIER_LIMITS: Record<PlanTier, TierLimit> = {
  free: {
    maxMembers: 3,
    maxVideos: 10,
    maxStorageBytes: 1 * 1024 * 1024 * 1024,        // 1 GB
    maxCategories: 3,
    sopGenerationsPerMonth: 3,
    transcribeMinutesPerMonth: 10,
    thumbnailGenerationsPerMonth: 5,
    customBranding: false,
    exportPdf: false,
    importTools: false,
    fullAnalytics: false,
    apiAccess: false,
    ssoSaml: false,
  },
  starter: {
    maxMembers: 10,
    maxVideos: 100,
    maxStorageBytes: 25 * 1024 * 1024 * 1024,       // 25 GB
    maxCategories: 15,
    sopGenerationsPerMonth: 25,
    transcribeMinutesPerMonth: 60,
    thumbnailGenerationsPerMonth: 30,
    customBranding: false,
    exportPdf: true,
    importTools: false,
    fullAnalytics: false,
    apiAccess: false,
    ssoSaml: false,
  },
  pro: {
    maxMembers: 50,
    maxVideos: 500,
    maxStorageBytes: 100 * 1024 * 1024 * 1024,      // 100 GB
    maxCategories: Infinity,
    sopGenerationsPerMonth: 100,
    transcribeMinutesPerMonth: 300,
    thumbnailGenerationsPerMonth: 120,
    customBranding: true,
    exportPdf: true,
    importTools: true,
    fullAnalytics: true,
    apiAccess: false,
    ssoSaml: false,
  },
  enterprise: {
    maxMembers: Infinity,
    maxVideos: Infinity,
    maxStorageBytes: 500 * 1024 * 1024 * 1024,      // 500 GB
    maxCategories: Infinity,
    sopGenerationsPerMonth: Infinity,
    transcribeMinutesPerMonth: Infinity,
    thumbnailGenerationsPerMonth: Infinity,
    customBranding: true,
    exportPdf: true,
    importTools: true,
    fullAnalytics: true,
    apiAccess: true,
    ssoSaml: true,
  },
}

export function isWithinLimit(current: number, limit: number): boolean {
  return current < limit
}

export function getTierLimits(plan: PlanTier): TierLimit {
  return TIER_LIMITS[plan]
}
```

**Step 3: Run tests, verify pass, commit**

```bash
npx jest __tests__/lib/tier-limits.test.ts
git add src/lib/utils/tier-limits.ts __tests__/lib/tier-limits.test.ts
git commit -m "feat: add tier limits utility with plan constants"
```

---

### Task 9: Deepgram Transcription Service

**Files:**
- Create: `sopflix/src/lib/ai/transcribe.ts`
- Create: `sopflix/src/app/api/ai/transcribe/route.ts`

**Step 1: Install Deepgram SDK**

```bash
npm install @deepgram/sdk
```

**Step 2: Create transcription service**

```typescript
// src/lib/ai/transcribe.ts
import { createClient } from '@deepgram/sdk'

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!)

export async function transcribeAudio(audioUrl: string): Promise<{
  transcript: string
  duration: number
}> {
  const { result } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: 'nova-2',
      smart_format: true,
      paragraphs: true,
      utterances: true,
    }
  )

  const transcript = result.results.channels[0].alternatives[0].paragraphs
    ?.transcript || result.results.channels[0].alternatives[0].transcript || ''

  const duration = result.metadata?.duration || 0

  return { transcript, duration: Math.ceil(duration / 60) }
}

export async function transcribeFile(audioBuffer: Buffer, mimetype: string): Promise<{
  transcript: string
  duration: number
}> {
  const { result } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-2',
      smart_format: true,
      paragraphs: true,
      mimetype,
    }
  )

  const transcript = result.results.channels[0].alternatives[0].paragraphs
    ?.transcript || result.results.channels[0].alternatives[0].transcript || ''

  const duration = result.metadata?.duration || 0

  return { transcript, duration: Math.ceil(duration / 60) }
}
```

**Step 3: Create API route**

```typescript
// src/app/api/ai/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transcribeAudio } from '@/lib/ai/transcribe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId, audioUrl } = await request.json()
  if (!videoId || !audioUrl) {
    return NextResponse.json({ error: 'videoId and audioUrl required' }, { status: 400 })
  }

  try {
    // Update video status
    await supabase.from('videos').update({ status: 'processing' }).eq('id', videoId)

    // Transcribe
    const { transcript, duration } = await transcribeAudio(audioUrl)

    // Save transcript to SOP record
    await supabase.from('sops').upsert({
      video_id: videoId,
      workspace_id: (await supabase.from('videos').select('workspace_id').eq('id', videoId).single()).data!.workspace_id,
      transcript,
      ai_generated: false,
    })

    // Update video duration
    await supabase.from('videos').update({ duration_seconds: duration * 60 }).eq('id', videoId)

    return NextResponse.json({ transcript, duration })
  } catch (error) {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/ai/transcribe.ts src/app/api/ai/
git commit -m "feat: add Deepgram transcription service and API route"
```

---

### Task 10: Claude SOP Generation Service

**Files:**
- Create: `sopflix/src/lib/ai/generate-sop.ts`
- Create: `sopflix/src/app/api/ai/generate-sop/route.ts`

**Step 1: Create SOP generation service**

```typescript
// src/lib/ai/generate-sop.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SOP_SYSTEM_PROMPT = `You are an SOP writer for enterprise teams. Given a video transcript of a walkthrough, create a structured Standard Operating Procedure.

Return a JSON object with this exact structure:
{
  "title": "SOP title",
  "purpose": "1-2 sentence description of what this procedure accomplishes",
  "prerequisites": ["list", "of", "prerequisites"],
  "steps": [
    {
      "number": 1,
      "action": "Clear action description",
      "details": "Additional details or expected result",
      "warning": "Optional warning or tip (null if none)"
    }
  ],
  "tips": ["Optional tips or best practices"],
  "related_processes": ["Referenced processes if any"]
}

Rules:
- Write clearly and concisely using active voice
- Each step should be actionable by someone who hasn't watched the video
- Include all important details from the transcript
- Keep prerequisites specific and actionable
- Only include tips that add genuine value
- Return ONLY valid JSON, no markdown or extra text`

export async function generateSOP(transcript: string): Promise<object> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: SOP_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate an SOP from this video transcript:\n\n${transcript}`
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text)
}
```

**Step 2: Create API route**

```typescript
// src/app/api/ai/generate-sop/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSOP } from '@/lib/ai/generate-sop'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await request.json()
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  try {
    // Get transcript from SOP record
    const { data: sop } = await supabase
      .from('sops').select('transcript, workspace_id').eq('video_id', videoId).single()

    if (!sop?.transcript) {
      return NextResponse.json({ error: 'No transcript found. Transcribe video first.' }, { status: 400 })
    }

    // Generate SOP
    const content = await generateSOP(sop.transcript)

    // Save generated SOP
    await supabase.from('sops').update({
      content,
      ai_generated: true,
      updated_at: new Date().toISOString(),
    }).eq('video_id', videoId)

    // Increment usage
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

    await supabase.rpc('increment_usage', {
      ws_id: sop.workspace_id,
      p_start: periodStart,
      p_end: periodEnd,
      field: 'sop_generations',
    })

    return NextResponse.json({ content })
  } catch (error) {
    return NextResponse.json({ error: 'SOP generation failed' }, { status: 500 })
  }
}
```

**Step 3: Create the usage increment function in SQL**

```sql
-- supabase/migrations/003_functions.sql
CREATE OR REPLACE FUNCTION increment_usage(
  ws_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  field TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_tracking (workspace_id, period_start, period_end)
  VALUES (ws_id, p_start, p_end)
  ON CONFLICT (workspace_id, period_start) DO NOTHING;

  EXECUTE format(
    'UPDATE usage_tracking SET %I = %I + 1 WHERE workspace_id = $1 AND period_start = $2',
    field, field
  ) USING ws_id, p_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 4: Commit**

```bash
git add src/lib/ai/generate-sop.ts src/app/api/ai/generate-sop/ supabase/
git commit -m "feat: add Claude SOP generation service with usage tracking"
```

---

### Task 11: NanoBanana Thumbnail Generation

**Files:**
- Create: `sopflix/src/lib/ai/generate-thumbnail.ts`
- Create: `sopflix/src/app/api/ai/generate-thumbnail/route.ts`

**Step 1: Create thumbnail generation service**

```typescript
// src/lib/ai/generate-thumbnail.ts

const NANOBANANA_API_URL = 'https://api.nanobanana.com/v1/generate' // Update with actual endpoint

const DEFAULT_TEMPLATE = `Professional thumbnail for a training video titled "{title}" in the "{category}" category. Clean corporate style, dark gradient background transitioning from deep navy to charcoal. Bold white text overlay showing the title. Subtle iconography related to the category. Modern, premium feel suitable for enterprise SaaS. 16:9 aspect ratio.`

export function buildThumbnailPrompt(title: string, category: string, customTemplate?: string): string {
  const template = customTemplate || DEFAULT_TEMPLATE
  return template
    .replace('{title}', title)
    .replace('{category}', category)
}

export async function generateThumbnail(prompt: string): Promise<Buffer> {
  const response = await fetch(NANOBANANA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NANOBANANA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      width: 1280,
      height: 720,
      format: 'png',
    }),
  })

  if (!response.ok) {
    throw new Error(`NanoBanana API error: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

**Step 2: Create API route**

```typescript
// src/app/api/ai/generate-thumbnail/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildThumbnailPrompt, generateThumbnail } from '@/lib/ai/generate-thumbnail'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId, title, category } = await request.json()
  if (!videoId || !title) {
    return NextResponse.json({ error: 'videoId and title required' }, { status: 400 })
  }

  try {
    const prompt = buildThumbnailPrompt(title, category || 'General')
    const imageBuffer = await generateThumbnail(prompt)

    // Upload to Supabase Storage
    const fileName = `thumbnails/${videoId}.png`
    const { error: uploadError } = await supabase.storage
      .from('sopflix')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('sopflix')
      .getPublicUrl(fileName)

    // Update video record
    await supabase.from('videos').update({
      thumbnail_url: publicUrl,
      thumbnail_source: 'generated',
      thumbnail_prompt: prompt,
    }).eq('id', videoId)

    return NextResponse.json({ thumbnailUrl: publicUrl, prompt })
  } catch (error) {
    return NextResponse.json({ error: 'Thumbnail generation failed' }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/generate-thumbnail.ts src/app/api/ai/generate-thumbnail/
git commit -m "feat: add NanoBanana thumbnail generation with template prompts"
```

---

## Phase 2: Netflix UI + Content Platform

### Task 12: Netflix Browse Page with Carousels

**Files:**
- Create: `sopflix/src/components/browse/video-carousel.tsx`
- Create: `sopflix/src/components/browse/video-card.tsx`
- Create: `sopflix/src/app/(app)/app/browse/page.tsx`

**Step 1: Create video card component**

```tsx
// src/components/browse/video-card.tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'

type VideoCardProps = {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  progressPct?: number
}

export function VideoCard({ id, title, description, thumbnailUrl, durationSeconds, progressPct }: VideoCardProps) {
  const [hovered, setHovered] = useState(false)

  const duration = durationSeconds
    ? `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`
    : null

  return (
    <Link href={`/app/watch/${id}`}>
      <div
        className="relative flex-shrink-0 w-72 rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-gray-800">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              No thumbnail
            </div>
          )}
          {duration && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-xs px-1.5 py-0.5 rounded">
              {duration}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progressPct !== undefined && progressPct > 0 && (
          <div className="h-1 bg-gray-700">
            <div className="h-full bg-red-600" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-end">
            <h3 className="font-semibold text-sm">{title}</h3>
            {description && (
              <p className="text-xs text-gray-300 mt-1 line-clamp-2">{description}</p>
            )}
            {progressPct !== undefined && (
              <p className="text-xs text-gray-400 mt-1">{Math.round(progressPct)}% complete</p>
            )}
          </div>
        )}

        {/* Title (visible when not hovered) */}
        {!hovered && (
          <div className="p-2">
            <h3 className="text-sm font-medium truncate">{title}</h3>
          </div>
        )}
      </div>
    </Link>
  )
}
```

**Step 2: Create carousel component**

```tsx
// src/components/browse/video-carousel.tsx
'use client'
import { useRef } from 'react'
import { VideoCard } from './video-card'

type Video = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  progress_pct?: number
}

type VideoCarouselProps = {
  title: string
  icon?: string
  videos: Video[]
}

export function VideoCarousel({ title, icon, videos }: VideoCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = direction === 'left' ? -600 : 600
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
  }

  if (videos.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-3 px-4">
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </h2>
      <div className="relative group">
        {/* Left arrow */}
        <button onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-gray-950 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-2xl">&lt;</span>
        </button>

        {/* Scrollable row */}
        <div ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 scroll-smooth">
          {videos.map(video => (
            <VideoCard
              key={video.id}
              id={video.id}
              title={video.title}
              description={video.description}
              thumbnailUrl={video.thumbnail_url}
              durationSeconds={video.duration_seconds}
              progressPct={video.progress_pct}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-gray-950 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-2xl">&gt;</span>
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Create browse page**

```tsx
// src/app/(app)/app/browse/page.tsx
import { createClient } from '@/lib/supabase/server'
import { VideoCarousel } from '@/components/browse/video-carousel'

export default async function BrowsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's workspace
  const { data: member } = await supabase
    .from('members').select('workspace_id').eq('user_id', user!.id).limit(1).single()
  const workspaceId = member!.workspace_id

  // Get continue watching (videos with progress)
  const { data: progressVideos } = await supabase
    .from('watch_progress')
    .select('progress_pct, video:videos(*)')
    .eq('user_id', user!.id)
    .eq('completed', false)
    .gt('progress_pct', 0)
    .order('last_watched_at', { ascending: false })
    .limit(20)

  const continueWatching = (progressVideos || []).map(p => ({
    ...(p.video as any),
    progress_pct: p.progress_pct,
  }))

  // Get categories with their videos
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, icon')
    .eq('workspace_id', workspaceId)
    .order('sort_order')

  const categoryVideos = await Promise.all(
    (categories || []).map(async (cat) => {
      const { data: videos } = await supabase
        .from('videos')
        .select('*')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20)
      return { ...cat, videos: videos || [] }
    })
  )

  return (
    <div className="py-6">
      {/* Search bar */}
      <div className="px-4 mb-8">
        <input
          type="text"
          placeholder="Search videos, SOPs, transcripts..."
          className="w-full max-w-xl p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
        />
      </div>

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <VideoCarousel title="Continue Watching" videos={continueWatching} />
      )}

      {/* Category rows */}
      {categoryVideos.map(cat => (
        <VideoCarousel
          key={cat.id}
          title={cat.name}
          icon={cat.icon || undefined}
          videos={cat.videos}
        />
      ))}

      {/* Empty state */}
      {categoryVideos.length === 0 && continueWatching.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-xl mb-2">No videos yet</p>
          <p>Start by <a href="/app/upload" className="text-red-400 hover:underline">uploading your first video</a></p>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/browse/ src/app/
git commit -m "feat: add Netflix-style browse page with carousels and video cards"
```

---

### Task 13: Video Watch Page (Split View)

**Files:**
- Create: `sopflix/src/components/watch/video-player.tsx`
- Create: `sopflix/src/components/watch/sop-viewer.tsx`
- Create: `sopflix/src/hooks/use-watch-progress.ts`
- Create: `sopflix/src/app/(app)/app/watch/[id]/page.tsx`

**Step 1: Create video player component**

```tsx
// src/components/watch/video-player.tsx
'use client'
import { getEmbedUrl } from '@/lib/utils/video-sources'

type VideoPlayerProps = {
  videoUrl: string
  videoSource: string
  title: string
}

export function VideoPlayer({ videoUrl, videoSource, title }: VideoPlayerProps) {
  // For embedded sources, use iframe
  if (['youtube', 'loom', 'vimeo'].includes(videoSource)) {
    // Extract video ID from the stored URL and build embed URL
    const embedUrl = videoUrl // Already stored as embed-ready in DB, or parse here
    return (
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // For uploaded files, use HTML5 video
  return (
    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
      <video src={videoUrl} controls className="w-full h-full">
        Your browser does not support video playback.
      </video>
    </div>
  )
}
```

**Step 2: Create SOP viewer component**

```tsx
// src/components/watch/sop-viewer.tsx
type SOPContent = {
  title: string
  purpose: string
  prerequisites: string[]
  steps: Array<{
    number: number
    action: string
    details: string
    warning: string | null
  }>
  tips: string[]
  related_processes: string[]
}

type SOPViewerProps = {
  content: SOPContent | null
  transcript: string | null
}

export function SOPViewer({ content, transcript }: SOPViewerProps) {
  if (!content && !transcript) {
    return (
      <div className="p-6 text-gray-400 text-center">
        <p>No SOP generated yet.</p>
      </div>
    )
  }

  if (!content && transcript) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Transcript</h3>
        <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{transcript}</p>
      </div>
    )
  }

  const sop = content!

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{sop.title}</h2>
        <p className="text-gray-400 mt-2">{sop.purpose}</p>
      </div>

      {sop.prerequisites.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Prerequisites</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            {sop.prerequisites.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3">Steps</h3>
        <div className="space-y-4">
          {sop.steps.map(step => (
            <div key={step.number} className="border-l-2 border-red-600 pl-4">
              <p className="font-medium">
                <span className="text-red-400 mr-2">Step {step.number}</span>
                {step.action}
              </p>
              <p className="text-gray-400 text-sm mt-1">{step.details}</p>
              {step.warning && (
                <p className="text-yellow-400 text-sm mt-1">Note: {step.warning}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {sop.tips.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Tips</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            {sop.tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {sop.related_processes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Related Processes</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            {sop.related_processes.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Create watch progress hook**

```typescript
// src/hooks/use-watch-progress.ts
'use client'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef } from 'react'

export function useWatchProgress(videoId: string, userId: string) {
  const supabase = createClient()
  const lastSaved = useRef(0)

  const saveProgress = useCallback(async (progressPct: number) => {
    // Throttle saves to every 5 seconds
    const now = Date.now()
    if (now - lastSaved.current < 5000) return
    lastSaved.current = now

    const completed = progressPct >= 95

    await supabase.from('watch_progress').upsert({
      user_id: userId,
      video_id: videoId,
      progress_pct: progressPct,
      completed,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' })
  }, [videoId, userId, supabase])

  // Increment view count on first load
  useEffect(() => {
    supabase.rpc('increment_view_count', { vid: videoId })
  }, [videoId])

  return { saveProgress }
}
```

**Step 4: Create watch page**

```tsx
// src/app/(app)/app/watch/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { VideoPlayer } from '@/components/watch/video-player'
import { SOPViewer } from '@/components/watch/sop-viewer'

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: video } = await supabase
    .from('videos').select('*').eq('id', id).single()

  if (!video) notFound()

  const { data: sop } = await supabase
    .from('sops').select('*').eq('video_id', id).single()

  return (
    <div className="h-screen flex">
      {/* Left: Video Player */}
      <div className="flex-1 flex flex-col p-4">
        <VideoPlayer
          videoUrl={video.video_url}
          videoSource={video.video_source}
          title={video.title}
        />
        <div className="mt-4">
          <h1 className="text-2xl font-bold">{video.title}</h1>
          {video.description && (
            <p className="text-gray-400 mt-2">{video.description}</p>
          )}
        </div>
      </div>

      {/* Right: SOP Document */}
      <div className="w-[480px] border-l border-gray-800 overflow-y-auto bg-gray-900">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4">
          <h2 className="font-semibold">Standard Operating Procedure</h2>
        </div>
        <SOPViewer
          content={sop?.content as any}
          transcript={sop?.transcript || null}
        />
      </div>
    </div>
  )
}
```

**Step 5: Add view count increment function**

```sql
-- Add to supabase/migrations/003_functions.sql
CREATE OR REPLACE FUNCTION increment_view_count(vid UUID)
RETURNS VOID AS $$
  UPDATE videos SET view_count = view_count + 1 WHERE id = vid;
$$ LANGUAGE sql SECURITY DEFINER;
```

**Step 6: Commit**

```bash
git add src/components/watch/ src/hooks/ src/app/ supabase/
git commit -m "feat: add split-view watch page with video player and SOP viewer"
```

---

### Task 14: Upload Page with AI Pipeline

**Files:**
- Create: `sopflix/src/app/(app)/app/upload/page.tsx`

**Step 1: Create upload page with full pipeline UI**

```tsx
// src/app/(app)/app/upload/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { parseVideoUrl } from '@/lib/utils/video-sources'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type ProcessingStep = 'idle' | 'creating' | 'transcribing' | 'generating_sop' | 'generating_thumbnail' | 'ready' | 'error'

export default function UploadPage() {
  const [videoUrl, setVideoUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [step, setStep] = useState<ProcessingStep>('idle')
  const [error, setError] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadCategories() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('members').select('workspace_id').eq('user_id', user.id).limit(1).single()
      if (!member) return
      const { data } = await supabase
        .from('categories').select('*').eq('workspace_id', member.workspace_id).order('sort_order')
      setCategories(data || [])
    }
    loadCategories()
  }, [])

  async function handleGenerate() {
    setError('')
    const parsed = parseVideoUrl(videoUrl)
    if (!parsed) { setError('Unsupported video URL. Use YouTube, Loom, or Vimeo.'); return }

    try {
      // Step 1: Create video record
      setStep('creating')
      const { data: { user } } = await supabase.auth.getUser()
      const { data: member } = await supabase
        .from('members').select('workspace_id').eq('user_id', user!.id).limit(1).single()

      const { data: video, error: createErr } = await supabase.from('videos').insert({
        workspace_id: member!.workspace_id,
        title,
        description: description || null,
        video_url: videoUrl,
        video_source: parsed.source,
        category_id: categoryId || null,
        uploaded_by: user!.id,
        status: 'processing',
      }).select().single()

      if (createErr) throw createErr
      setVideoId(video.id)

      // Step 2: Transcribe
      setStep('transcribing')
      const transcribeRes = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, audioUrl: videoUrl }),
      })
      if (!transcribeRes.ok) throw new Error('Transcription failed')

      // Step 3: Generate SOP
      setStep('generating_sop')
      const sopRes = await fetch('/api/ai/generate-sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id }),
      })
      if (!sopRes.ok) throw new Error('SOP generation failed')

      // Step 4: Generate thumbnail
      setStep('generating_thumbnail')
      const category = categories.find(c => c.id === categoryId)
      const thumbRes = await fetch('/api/ai/generate-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          title,
          category: category?.name || 'General',
        }),
      })
      if (!thumbRes.ok) throw new Error('Thumbnail generation failed')

      // Update status to ready for review
      await supabase.from('videos').update({ status: 'ready_for_review' }).eq('id', video.id)

      setStep('ready')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStep('error')
    }
  }

  const stepLabels: Record<ProcessingStep, string> = {
    idle: '',
    creating: 'Creating video record...',
    transcribing: 'Transcribing audio (this may take a minute)...',
    generating_sop: 'Generating SOP with AI...',
    generating_thumbnail: 'Creating thumbnail...',
    ready: 'Done! Ready for review.',
    error: 'An error occurred.',
  }

  const stepProgress: Record<ProcessingStep, number> = {
    idle: 0, creating: 10, transcribing: 30, generating_sop: 60, generating_thumbnail: 85, ready: 100, error: 0,
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Upload Video</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Video URL</label>
          <input type="url" placeholder="https://youtube.com/watch?v=... or Loom/Vimeo link"
            value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg" disabled={step !== 'idle'} />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input type="text" placeholder="How to onboard a new client"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg" disabled={step !== 'idle'} />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
          <textarea placeholder="Brief description of this walkthrough..."
            value={description} onChange={e => setDescription(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg h-20" disabled={step !== 'idle'} />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg" disabled={step !== 'idle'}>
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {error && <p className="text-red-400">{error}</p>}

        {/* Progress indicator */}
        {step !== 'idle' && step !== 'error' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>{stepLabels[step]}</span>
              <span>{stepProgress[step]}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 transition-all duration-500 rounded-full"
                style={{ width: `${stepProgress[step]}%` }} />
            </div>
          </div>
        )}

        {step === 'idle' && (
          <button onClick={handleGenerate} disabled={!videoUrl || !title}
            className="w-full p-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold disabled:opacity-50">
            Generate SOP & Thumbnail
          </button>
        )}

        {step === 'ready' && videoId && (
          <div className="flex gap-3">
            <a href={`/app/watch/${videoId}`}
              className="flex-1 p-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-center">
              Review & Publish
            </a>
            <button onClick={() => { setStep('idle'); setVideoId(null); setVideoUrl(''); setTitle(''); setDescription('') }}
              className="flex-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold">
              Upload Another
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/
git commit -m "feat: add upload page with AI pipeline progress indicator"
```

---

### Task 15: Library Page (All Videos, Filterable)

**Files:**
- Create: `sopflix/src/app/(app)/app/library/page.tsx`

**Step 1: Create library page with search and filters**

```tsx
// src/app/(app)/app/library/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { q, category } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: member } = await supabase
    .from('members').select('workspace_id').eq('user_id', user!.id).limit(1).single()
  const workspaceId = member!.workspace_id

  // Get categories for filter
  const { data: categories } = await supabase
    .from('categories').select('*').eq('workspace_id', workspaceId).order('sort_order')

  // Build video query
  let query = supabase
    .from('videos')
    .select('*, category:categories(name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category_id', category)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: videos } = await query

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Library</h1>

      {/* Filters */}
      <form className="flex gap-3 mb-6">
        <input type="text" name="q" defaultValue={q} placeholder="Search videos..."
          className="flex-1 max-w-md p-2 bg-gray-800 border border-gray-700 rounded-lg" />
        <select name="category" defaultValue={category}
          className="p-2 bg-gray-800 border border-gray-700 rounded-lg">
          <option value="">All categories</option>
          {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">Search</button>
      </form>

      {/* Video grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(videos || []).map(video => (
          <Link key={video.id} href={`/app/watch/${video.id}`}
            className="bg-gray-900 rounded-lg overflow-hidden hover:ring-1 hover:ring-red-600 transition-all">
            <div className="aspect-video bg-gray-800">
              {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">No thumbnail</div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-medium truncate">{video.title}</h3>
              <p className="text-sm text-gray-400">{(video.category as any)?.name || 'Uncategorized'}</p>
            </div>
          </Link>
        ))}
      </div>

      {(videos || []).length === 0 && (
        <p className="text-center text-gray-400 py-12">No videos found.</p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/
git commit -m "feat: add library page with search and category filtering"
```

---

### Task 16: Category Management (Admin)

**Files:**
- Create: `sopflix/src/app/(app)/app/admin/page.tsx`

**Step 1: Create admin page with category CRUD**

```tsx
// src/app/(app)/app/admin/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('members').select('workspace_id').eq('user_id', user.id).limit(1).single()
      if (!member) return
      setWorkspaceId(member.workspace_id)
      const { data } = await supabase
        .from('categories').select('*').eq('workspace_id', member.workspace_id).order('sort_order')
      setCategories(data || [])
    }
    load()
  }, [])

  async function addCategory() {
    if (!newName.trim()) return
    const { data } = await supabase.from('categories').insert({
      workspace_id: workspaceId, name: newName.trim(), sort_order: categories.length,
    }).select().single()
    if (data) setCategories([...categories, data])
    setNewName('')
  }

  async function deleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    setCategories(categories.filter(c => c.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Workspace Admin</h1>

      <h2 className="text-xl font-semibold mb-4">Categories</h2>

      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="New category name" value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCategory()}
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg" />
        <button onClick={addCategory} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">Add</button>
      </div>

      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span>{cat.name}</span>
            <button onClick={() => deleteCategory(cat.id)}
              className="text-red-400 hover:text-red-300 text-sm">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/
git commit -m "feat: add admin page with category management"
```

---

## Phase 3: SaaS Layer + Monetization

### Task 17: PayPal Integration

**Files:**
- Create: `sopflix/src/lib/paypal/client.ts`
- Create: `sopflix/src/lib/paypal/webhooks.ts`
- Create: `sopflix/src/app/api/webhooks/paypal/route.ts`
- Create: `sopflix/src/app/(app)/app/admin/billing/page.tsx`

**Step 1: Install PayPal SDK**

```bash
npm install @paypal/checkout-server-sdk @paypal/react-paypal-js
```

**Step 2: Create PayPal server client**

```typescript
// src/lib/paypal/client.ts
import paypal from '@paypal/checkout-server-sdk'

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID!
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!

  // Use Sandbox for dev, Live for production
  if (process.env.NODE_ENV === 'production') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret)
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret)
}

export const paypalClient = new paypal.core.PayPalHttpClient(environment())

// PayPal plan IDs (create these in PayPal dashboard)
export const PAYPAL_PLAN_IDS = {
  starter: process.env.PAYPAL_PLAN_STARTER || '',
  pro: process.env.PAYPAL_PLAN_PRO || '',
  enterprise: process.env.PAYPAL_PLAN_ENTERPRISE || '',
} as const
```

**Step 3: Create webhook handler**

```typescript
// src/lib/paypal/webhooks.ts
import { createClient } from '@supabase/supabase-js'

// Use service role for webhook processing (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function handleSubscriptionActivated(event: any) {
  const subscriptionId = event.resource.id
  const planId = event.resource.plan_id

  // Map PayPal plan ID to our tier
  const plan = Object.entries({
    starter: process.env.PAYPAL_PLAN_STARTER,
    pro: process.env.PAYPAL_PLAN_PRO,
    enterprise: process.env.PAYPAL_PLAN_ENTERPRISE,
  }).find(([, id]) => id === planId)?.[0] || 'free'

  await supabase.from('subscriptions').update({
    paypal_subscription_id: subscriptionId,
    paypal_plan_id: planId,
    plan: plan as any,
    status: 'active',
    current_period_start: event.resource.start_time,
  }).eq('paypal_subscription_id', subscriptionId)
}

export async function handleSubscriptionCancelled(event: any) {
  const subscriptionId = event.resource.id
  await supabase.from('subscriptions').update({
    status: 'cancelled',
    plan: 'free',
  }).eq('paypal_subscription_id', subscriptionId)

  // Also update workspace plan
  const { data: sub } = await supabase
    .from('subscriptions').select('workspace_id').eq('paypal_subscription_id', subscriptionId).single()
  if (sub) {
    await supabase.from('workspaces').update({ plan: 'free' }).eq('id', sub.workspace_id)
  }
}

export async function handlePaymentCompleted(event: any) {
  const subscriptionId = event.resource.billing_agreement_id
  if (!subscriptionId) return

  await supabase.from('subscriptions').update({
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('paypal_subscription_id', subscriptionId)
}
```

**Step 4: Create webhook API route**

```typescript
// src/app/api/webhooks/paypal/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { handleSubscriptionActivated, handleSubscriptionCancelled, handlePaymentCompleted } from '@/lib/paypal/webhooks'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const eventType = body.event_type

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(body)
        break
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionCancelled(body)
        break
      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(body)
        break
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
```

**Step 5: Create billing admin page**

```tsx
// src/app/(app)/app/admin/billing/page.tsx
'use client'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const PLANS = [
  { key: 'starter', name: 'Starter', price: '$29/mo', paypalPlanId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER },
  { key: 'pro', name: 'Pro', price: '$79/mo', paypalPlanId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO },
  { key: 'enterprise', name: 'Enterprise', price: '$199/mo', paypalPlanId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE },
]

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState('free')
  const [workspaceId, setWorkspaceId] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('members').select('workspace_id').eq('user_id', user.id).limit(1).single()
      if (!member) return
      setWorkspaceId(member.workspace_id)
      const { data: sub } = await supabase
        .from('subscriptions').select('plan').eq('workspace_id', member.workspace_id).single()
      if (sub) setCurrentPlan(sub.plan)
    }
    load()
  }, [])

  return (
    <PayPalScriptProvider options={{
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
      vault: true,
      intent: 'subscription',
    }}>
      <div className="p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Billing</h1>
        <p className="text-gray-400 mb-8">Current plan: <span className="text-white font-semibold capitalize">{currentPlan}</span></p>

        <div className="grid grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div key={plan.key}
              className={`p-6 rounded-xl border ${currentPlan === plan.key ? 'border-red-600 bg-gray-800' : 'border-gray-700 bg-gray-900'}`}>
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-2xl font-bold text-red-400 my-2">{plan.price}</p>
              {currentPlan === plan.key ? (
                <p className="text-green-400 font-medium">Current plan</p>
              ) : plan.paypalPlanId ? (
                <PayPalButtons
                  style={{ layout: 'vertical', label: 'subscribe' }}
                  createSubscription={(data, actions) => {
                    return actions.subscription.create({ plan_id: plan.paypalPlanId! })
                  }}
                  onApprove={async (data) => {
                    // Update subscription record
                    await supabase.from('subscriptions').update({
                      paypal_subscription_id: data.subscriptionID,
                      plan: plan.key as any,
                      status: 'active',
                    }).eq('workspace_id', workspaceId)

                    await supabase.from('workspaces').update({ plan: plan.key as any }).eq('id', workspaceId)
                    setCurrentPlan(plan.key)
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </PayPalScriptProvider>
  )
}
```

**Step 6: Commit**

```bash
git add src/lib/paypal/ src/app/api/webhooks/ src/app/
git commit -m "feat: add PayPal subscription integration with webhooks and billing page"
```

---

### Task 18: Team Management Page

**Files:**
- Create: `sopflix/src/app/(app)/app/admin/team/page.tsx`

**Step 1: Create team management page**

```tsx
// src/app/(app)/app/admin/team/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [workspaceId, setWorkspaceId] = useState('')
  const [myRole, setMyRole] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('members').select('workspace_id, role').eq('user_id', user.id).limit(1).single()
      if (!member) return
      setWorkspaceId(member.workspace_id)
      setMyRole(member.role)
      const { data } = await supabase
        .from('members').select('*, user:users(name, email)').eq('workspace_id', member.workspace_id)
      setMembers(data || [])
    }
    load()
  }, [])

  async function inviteMember() {
    if (!inviteEmail.trim()) return
    // In production, send invitation email. For now, add directly if user exists.
    const { data: existingUser } = await supabase
      .from('users').select('id').eq('email', inviteEmail.trim()).single()
    if (!existingUser) { alert('User not found. They need to sign up first.'); return }

    const { data } = await supabase.from('members').insert({
      user_id: existingUser.id, workspace_id: workspaceId, role: inviteRole as any,
    }).select('*, user:users(name, email)').single()
    if (data) setMembers([...members, data])
    setInviteEmail('')
  }

  async function removeMember(memberId: string) {
    await supabase.from('members').delete().eq('id', memberId)
    setMembers(members.filter(m => m.id !== memberId))
  }

  async function updateRole(memberId: string, newRole: string) {
    await supabase.from('members').update({ role: newRole as any }).eq('id', memberId)
    setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Team</h1>

      {canManage && (
        <div className="flex gap-2 mb-6">
          <input type="email" placeholder="Email address" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg">
            <option value="viewer">Viewer</option>
            <option value="contributor">Contributor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={inviteMember} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">Invite</button>
        </div>
      )}

      <div className="space-y-2">
        {members.map(member => (
          <div key={member.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <div>
              <p className="font-medium">{(member.user as any)?.name}</p>
              <p className="text-sm text-gray-400">{(member.user as any)?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && member.role !== 'owner' ? (
                <>
                  <select value={member.role} onChange={e => updateRole(member.id, e.target.value)}
                    className="p-1 bg-gray-800 border border-gray-700 rounded text-sm">
                    <option value="viewer">Viewer</option>
                    <option value="contributor">Contributor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => removeMember(member.id)}
                    className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                </>
              ) : (
                <span className="text-sm text-gray-400 capitalize">{member.role}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/
git commit -m "feat: add team management page with invite, roles, and remove"
```

---

### Task 19: Landing Page

**Files:**
- Create: `sopflix/src/app/(public)/page.tsx`
- Create: `sopflix/src/app/(public)/pricing/page.tsx`

**Step 1: Create landing page**

Build a compelling landing page with hero, features, pricing preview, and CTA. Reference the tier table from the design doc. Use Tailwind for styling with the dark theme (gray-950 background, red-600 accents).

**Step 2: Create pricing page**

Build a detailed pricing comparison page with all tier features from the design doc. Include PayPal subscribe buttons for each paid tier.

**Step 3: Commit**

```bash
git add src/app/
git commit -m "feat: add landing page and pricing page"
```

---

### Task 20: Global Search

**Files:**
- Create: `sopflix/src/app/api/search/route.ts`
- Modify: `sopflix/src/app/(app)/app/browse/page.tsx` — wire up search bar

**Step 1: Create search API that queries videos, SOPs, and transcripts**

```typescript
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ results: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Search videos by title/description
  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, description, thumbnail_url, duration_seconds, status')
    .eq('status', 'published')
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(20)

  // Search SOPs by transcript content
  const { data: sopResults } = await supabase
    .from('sops')
    .select('video_id, videos(id, title, thumbnail_url, duration_seconds)')
    .ilike('transcript', `%${q}%`)
    .limit(10)

  // Merge and deduplicate
  const allIds = new Set<string>()
  const results: any[] = []

  for (const v of videos || []) {
    if (!allIds.has(v.id)) { allIds.add(v.id); results.push(v) }
  }
  for (const s of sopResults || []) {
    const v = s.videos as any
    if (v && !allIds.has(v.id)) { allIds.add(v.id); results.push(v) }
  }

  return NextResponse.json({ results })
}
```

**Step 2: Commit**

```bash
git add src/app/api/search/ src/app/
git commit -m "feat: add global search across videos, descriptions, and transcripts"
```

---

### Task 21: PDF Export for SOPs

**Files:**
- Create: `sopflix/src/app/api/export/pdf/route.ts`

**Step 1: Install PDF library**

```bash
npm install @react-pdf/renderer
```

**Step 2: Create PDF export API route that takes a video ID, fetches the SOP content, and returns a PDF download**

**Step 3: Commit**

```bash
git add src/app/api/export/
git commit -m "feat: add PDF export for SOP documents"
```

---

### Task 22: Vercel Deployment Configuration

**Files:**
- Create: `sopflix/vercel.json`
- Modify: `sopflix/.env.local.example` — document all required env vars

**Step 1: Create Vercel config**

```json
{
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

**Step 2: Document deployment steps**

- Push to GitHub
- Connect repo in Vercel dashboard
- Add all env vars from `.env.local.example`
- Create Supabase storage bucket named `sopflix` (public)
- Configure PayPal webhook URL to `https://your-domain.com/api/webhooks/paypal`

**Step 3: Commit**

```bash
git add vercel.json .env.local.example
git commit -m "chore: add Vercel deployment configuration"
```

---

## Summary

| Phase | Tasks | What You Get |
|-------|-------|-------------|
| **Phase 1** (Tasks 1-11) | Project setup, DB schema, RLS, auth, AI pipeline | Working backend with transcription, SOP generation, thumbnails |
| **Phase 2** (Tasks 12-16) | Browse, watch, upload, library, admin pages | Full Netflix-style UI with all user flows |
| **Phase 3** (Tasks 17-22) | PayPal, team mgmt, landing page, search, export, deploy | Monetizable SaaS ready for launch |

**Total: 22 tasks across 3 phases.**
