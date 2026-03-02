-- ============================================================
-- BryanOS 1.0 — Database Schema
-- Supabase (PostgreSQL) migration
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE workspace_plan AS ENUM ('free', 'pro', 'agency', 'enterprise');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'builder', 'viewer');
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'qa', 'done', 'blocked');
CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE assignment_rule_type AS ENUM ('client', 'system', 'time', 'default');
CREATE TYPE ai_provider AS ENUM ('claude', 'openai');
CREATE TYPE notification_channel AS ENUM ('webhook', 'telegram', 'slack', 'email');
CREATE TYPE activity_action AS ENUM (
  'task_created', 'task_updated', 'task_completed', 'task_deleted',
  'task_assigned', 'task_commented', 'transcript_processed',
  'member_invited', 'member_removed', 'client_created'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Workspaces (multi-tenant isolation)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plan workspace_plan NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Manila',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace membership (roles + permissions)
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'builder',
  specialties TEXT[] DEFAULT '{}',
  schedule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- BUSINESS TABLES
-- ============================================================

-- Clients per workspace
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
  backup_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority_level task_priority DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- Systems / platforms tracked per workspace
CREATE TABLE systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_assignee UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- Tasks (the core entity)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'not_started',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  meeting_timestamp TEXT,
  notes TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_completed TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  estimated_hours REAL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task comments / activity
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assignment rules engine
CREATE TABLE assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_type assignment_rule_type NOT NULL,
  condition_value TEXT NOT NULL,
  assignee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority_order INT NOT NULL DEFAULT 99,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI & PROCESSING TABLES
-- ============================================================

-- Transcript processing history
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  raw_transcript TEXT NOT NULL,
  formatted_output TEXT,
  ai_provider ai_provider,
  tasks_extracted INT NOT NULL DEFAULT 0,
  processed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI daily briefings (cached)
CREATE TABLE ai_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  briefing_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id, briefing_date)
);

-- ============================================================
-- ACTIVITY & NOTIFICATIONS
-- ============================================================

-- Activity log (audit trail)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action activity_action NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification configs per workspace
CREATE TABLE notification_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  webhook_url TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS & BILLING
-- ============================================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plan workspace_plan NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  tasks_created INT NOT NULL DEFAULT 0,
  transcripts_processed INT NOT NULL DEFAULT 0,
  ai_calls INT NOT NULL DEFAULT 0,
  referral_messages_generated INT NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, period_start)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Workspace members
CREATE INDEX idx_ws_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_ws_members_user ON workspace_members(user_id);

-- Tasks (heavily queried)
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_priority ON tasks(workspace_id, priority);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_client ON tasks(client_id);
CREATE INDEX idx_tasks_system ON tasks(system_id);
CREATE INDEX idx_tasks_created ON tasks(workspace_id, created_at DESC);
CREATE INDEX idx_tasks_number ON tasks(workspace_id, task_number);

-- Task comments
CREATE INDEX idx_comments_task ON task_comments(task_id);

-- Clients
CREATE INDEX idx_clients_workspace ON clients(workspace_id);

-- Systems
CREATE INDEX idx_systems_workspace ON systems(workspace_id);

-- Assignment rules
CREATE INDEX idx_rules_workspace ON assignment_rules(workspace_id);

-- Transcripts
CREATE INDEX idx_transcripts_workspace ON transcripts(workspace_id);

-- Activity log (time-series queries)
CREATE INDEX idx_activity_workspace ON activity_log(workspace_id, created_at DESC);
CREATE INDEX idx_activity_target ON activity_log(target_type, target_id);

-- Notification configs
CREATE INDEX idx_notif_workspace ON notification_configs(workspace_id);
