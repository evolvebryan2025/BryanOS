# SOPFlix — Design Document

**Date:** 2026-03-02
**Status:** Approved
**Product:** Netflix-style video + SOP platform for internal teams/enterprises

---

## Overview

SOPFlix is a multi-tenant SaaS platform where companies upload walkthrough videos and get AI-generated Standard Operating Procedures. It combines a Netflix-style browsing experience with an AI-powered SOP generation engine, sold on a tiered subscription model.

**Target customer:** Internal teams and enterprises who need a video knowledge base for onboarding and operations.

---

## Architecture

### Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Database + Auth + Storage:** Supabase (Postgres + RLS)
- **AI SOP Generation:** Claude API (Anthropic)
- **Transcription:** Deepgram (primary), OpenAI Whisper (fallback)
- **Thumbnail Generation:** NanoBanana API (template-based prompts)
- **Payments:** PayPal Subscriptions API
- **Video Hosting (MVP):** Embed YouTube/Loom/Vimeo links
- **Video Hosting (Scale):** Cloudflare Stream or Mux
- **Deployment:** Vercel

### Multi-Tenancy Model

Each paying customer gets a **workspace**. Users belong to a workspace with roles (Owner, Admin, Contributor, Viewer). Data is isolated per workspace via Supabase Row-Level Security (RLS).

### System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        SOPFlix                           │
│                                                          │
│  ┌──────────┐   ┌───────────────┐   ┌────────────────┐  │
│  │  Auth &   │   │  Content      │   │  AI Pipeline   │  │
│  │  Billing  │   │  Platform     │   │                │  │
│  │          │   │               │   │ Upload → Trans- │  │
│  │ Supabase │   │ Netflix-style │   │ cribe → Generate│  │
│  │ Auth     │   │ browse/watch  │   │ SOP docs       │  │
│  │ PayPal   │   │ Categories    │   │                │  │
│  │ Roles    │   │ Search        │   │ Claude API     │  │
│  │ Spaces   │   │ Video player  │   │ NanoBanana     │  │
│  └──────────┘   └───────────────┘   └────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │           Supabase (Postgres + Storage)           │    │
│  │  Users, Workspaces, Videos, SOPs, Subscriptions   │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## Data Model

### Tables

**workspaces**
- `id` (uuid, PK)
- `name` (text)
- `slug` (text, unique)
- `logo_url` (text, nullable)
- `plan` (enum: free/starter/pro/enterprise)
- `stripe_id` → `paypal_customer_id` (text)
- `created_at` (timestamptz)

**users**
- `id` (uuid, PK, references auth.users)
- `email` (text)
- `name` (text)
- `avatar_url` (text, nullable)
- `created_at` (timestamptz)

**members**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `workspace_id` (uuid, FK → workspaces)
- `role` (enum: owner/admin/contributor/viewer)
- `invited_at` (timestamptz)

**categories**
- `id` (uuid, PK)
- `workspace_id` (uuid, FK → workspaces)
- `name` (text)
- `description` (text, nullable)
- `icon` (text, nullable)
- `sort_order` (int)
- `created_at` (timestamptz)

**videos**
- `id` (uuid, PK)
- `workspace_id` (uuid, FK → workspaces)
- `category_id` (uuid, FK → categories)
- `title` (text)
- `description` (text, nullable)
- `thumbnail_url` (text, nullable)
- `thumbnail_source` (enum: generated/custom)
- `thumbnail_prompt` (text, nullable)
- `video_url` (text)
- `video_source` (enum: youtube/loom/vimeo/cloudflare/upload)
- `duration_seconds` (int, nullable)
- `uploaded_by` (uuid, FK → users)
- `status` (enum: draft/processing/published)
- `view_count` (int, default 0)
- `created_at` (timestamptz)

**sops**
- `id` (uuid, PK)
- `video_id` (uuid, FK → videos, unique)
- `workspace_id` (uuid, FK → workspaces)
- `content` (jsonb) — rich text SOP document
- `transcript` (text) — raw transcript
- `ai_generated` (bool)
- `version` (int, default 1)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**watch_progress**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `video_id` (uuid, FK → videos)
- `progress_pct` (float)
- `completed` (bool)
- `last_watched_at` (timestamptz)

**subscriptions**
- `id` (uuid, PK)
- `workspace_id` (uuid, FK → workspaces)
- `paypal_subscription_id` (text)
- `paypal_plan_id` (text)
- `plan` (enum: free/starter/pro/enterprise)
- `status` (text)
- `current_period_start` (timestamptz)
- `current_period_end` (timestamptz)
- `created_at` (timestamptz)

**usage_tracking**
- `id` (uuid, PK)
- `workspace_id` (uuid, FK → workspaces)
- `period_start` (timestamptz)
- `period_end` (timestamptz)
- `sop_generations` (int, default 0)
- `transcribe_minutes` (float, default 0)
- `thumbnail_generations` (int, default 0)
- `storage_bytes` (bigint, default 0)

### Key Design Decisions

- Videos and SOPs are 1:1 — every video can have one SOP document
- SOPs use JSONB for rich structured content (steps, screenshots, notes)
- Watch progress tracked per user — enables "Continue Watching" and completion tracking
- Categories are per-workspace — each company organizes content their way
- Roles: Owner > Admin > Contributor > Viewer
- RLS on all tables filtered by workspace_id

---

## User Experience

### Page Structure

**Public pages:**
- `/` — Landing page with pricing, features, CTA
- `/login` — Sign in
- `/signup` — Create account + workspace
- `/pricing` — Detailed tier comparison

**Authenticated app (`/app/`):**
- `/app/browse` — Netflix-style home with horizontal carousels per category
- `/app/watch/[id]` — Split view: video player (left) + SOP document (right)
- `/app/library` — All videos, filterable and searchable
- `/app/upload` — Upload video + AI generate SOP + thumbnail
- `/app/admin` — Workspace settings
- `/app/admin/team` — Manage members + roles
- `/app/admin/billing` — PayPal subscription management

### Netflix Experience Flow

1. User lands on `/app/browse` — sees horizontal carousels per category, "Continue Watching" row at top
2. Hover on thumbnail — shows title, duration, completion %, description
3. Click a video — split view with video + SOP
4. Progress auto-saves — pick up where you left off
5. Global search across titles, descriptions, transcripts, SOP content

### Upload Flow

1. Go to `/app/upload`
2. Paste a video link (YouTube/Loom/Vimeo) OR upload a file
3. Click "Generate SOP" — AI transcribes and produces structured SOP
4. Thumbnail auto-generated via NanoBanana
5. Review and edit SOP in rich text editor
6. Assign category, publish

---

## AI Pipeline

### Processing Flow

```
Upload Video → Transcribe (Deepgram) → Generate SOP (Claude) → Generate Thumbnail (NanoBanana) → Review & Publish
```

### Transcription (Step 1)
- Embedded links: extract audio or pull existing captions via API
- Uploaded files: send audio to Deepgram, Whisper as fallback
- Raw transcript stored in `sops.transcript`

### SOP Generation (Step 2)
- Claude API with system prompt for structured SOP output
- Format: Title, Purpose, Prerequisites, Numbered Steps, Tips & Warnings, Related Processes
- Output stored as JSONB in `sops.content`

### Thumbnail Generation (Step 3)
- NanoBanana API with configurable template prompts
- Template constructed from video title + category
- Per-workspace prompt templates for brand consistency
- Stored in Supabase Storage

### Processing Status Flow
```
draft → processing (transcribing) → processing (generating SOP) → processing (thumbnail) → ready for review → published
```

---

## Subscription Tiers

|                     | Free    | Starter ($29/mo) | Pro ($79/mo) | Enterprise ($199/mo) |
|---------------------|---------|-------------------|--------------|----------------------|
| Team members        | 3       | 10                | 50           | Unlimited            |
| Videos              | 10      | 100               | 500          | Unlimited            |
| Storage             | 1 GB    | 25 GB             | 100 GB       | 500 GB               |
| Categories          | 3       | 15                | Unlimited    | Unlimited            |
| AI SOPs/month       | 3       | 25                | 100          | Unlimited            |
| Transcribe min/mo   | 10      | 60                | 300          | Unlimited            |
| Thumbnails/month    | 5       | 30                | 120          | Unlimited            |
| Custom branding     | No      | No                | Yes          | Yes                  |
| Export PDF           | No      | Yes               | Yes          | Yes                  |
| Import tools        | No      | No                | Yes          | Yes                  |
| Analytics           | Basic   | Basic             | Full         | Full                 |
| API access          | No      | No                | No           | Yes                  |
| SSO/SAML            | No      | No                | No           | Yes                  |
| Support             | —       | Email             | Chat         | Dedicated            |

### PayPal Integration

- **Checkout:** PayPal Subscriptions API for recurring billing
- **Management:** PayPal buyer dashboard for plan changes and cancellation
- **Webhooks:** `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `PAYMENT.SALE.COMPLETED`
- **Frontend:** PayPal JavaScript SDK buttons
- **Usage enforcement:** Check `usage_tracking` table before each AI operation

---

## Build Phases

### Phase 1: Foundation + AI Engine (Week 1-2)
- Next.js project setup with Supabase
- Database schema + RLS policies
- Supabase Auth (email/password + Google OAuth)
- Video upload flow (embed links + file upload)
- Transcription pipeline (Deepgram)
- Claude API SOP generation with system prompt
- NanoBanana thumbnail generation with template prompts
- Background job processing with status tracking

### Phase 2: Netflix UI + Content Platform (Week 2-3)
- Landing page with features, pricing, CTA
- Netflix-style browse page with horizontal carousels
- Thumbnail hover cards with preview info
- Split-view watch page (video + SOP)
- "Continue Watching" row based on watch progress
- Global search across titles, descriptions, transcripts
- Rich text SOP editor for manual edits
- Category management (CRUD)
- Upload page with AI generation progress indicator

### Phase 3: SaaS Layer + Monetization (Week 3-4)
- PayPal Subscriptions API integration
- Tier enforcement (limits on AI, storage, members)
- Usage tracking + limit checks
- Upgrade prompts when limits hit
- Workspace settings + branding (Pro+)
- Team management (invite, roles, remove)
- Admin dashboard with analytics
- PDF export for SOPs (Starter+)

### Post-Launch Roadmap
- Cloudflare Stream migration for self-hosted video
- Import from Google Drive / Notion / Loom
- Mobile responsive refinements
- API access for Enterprise tier
- SSO/SAML for Enterprise
- Version history for SOPs
