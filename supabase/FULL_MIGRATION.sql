-- ============================================================
-- BryanOS 1.0 — FULL DATABASE SETUP
-- Paste this entire file into Supabase SQL Editor and click Run
-- ============================================================

-- ============================================================
-- PART 1: SCHEMA (tables, enums, indexes)
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

-- Subscriptions & Billing
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

-- Indexes
CREATE INDEX idx_ws_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_ws_members_user ON workspace_members(user_id);
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_priority ON tasks(workspace_id, priority);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_client ON tasks(client_id);
CREATE INDEX idx_tasks_system ON tasks(system_id);
CREATE INDEX idx_tasks_created ON tasks(workspace_id, created_at DESC);
CREATE INDEX idx_tasks_number ON tasks(workspace_id, task_number);
CREATE INDEX idx_comments_task ON task_comments(task_id);
CREATE INDEX idx_clients_workspace ON clients(workspace_id);
CREATE INDEX idx_systems_workspace ON systems(workspace_id);
CREATE INDEX idx_rules_workspace ON assignment_rules(workspace_id);
CREATE INDEX idx_transcripts_workspace ON transcripts(workspace_id);
CREATE INDEX idx_activity_workspace ON activity_log(workspace_id, created_at DESC);
CREATE INDEX idx_activity_target ON activity_log(target_type, target_id);
CREATE INDEX idx_notif_workspace ON notification_configs(workspace_id);

-- ============================================================
-- PART 2: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_role(ws_id UUID, required_role member_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = auth.uid()
      AND workspace_id = ws_id
      AND role <= required_role
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = auth.uid()
      AND workspace_id = ws_id
      AND role IN ('owner', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users policies
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_select_teammates" ON users FOR SELECT USING (
  id IN (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id IN (SELECT get_my_workspace_ids()))
);

-- Workspaces policies
CREATE POLICY "workspaces_select" ON workspaces FOR SELECT USING (id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT WITH CHECK (true);
CREATE POLICY "workspaces_update" ON workspaces FOR UPDATE USING (is_workspace_admin(id));
CREATE POLICY "workspaces_delete" ON workspaces FOR DELETE USING (has_role(id, 'owner'));

-- Workspace members policies
CREATE POLICY "members_select" ON workspace_members FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "members_insert" ON workspace_members FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "members_update" ON workspace_members FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "members_delete" ON workspace_members FOR DELETE USING (is_workspace_admin(workspace_id));

-- Clients policies
CREATE POLICY "clients_select" ON clients FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (is_workspace_admin(workspace_id));

-- Systems policies
CREATE POLICY "systems_select" ON systems FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "systems_insert" ON systems FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "systems_update" ON systems FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "systems_delete" ON systems FOR DELETE USING (is_workspace_admin(workspace_id));

-- Tasks policies
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_my_workspace_ids()) AND has_role(workspace_id, 'builder')
);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (
  workspace_id IN (SELECT get_my_workspace_ids()) AND has_role(workspace_id, 'builder')
);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (is_workspace_admin(workspace_id));

-- Task comments policies
CREATE POLICY "comments_select" ON task_comments FOR SELECT USING (
  task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT get_my_workspace_ids()))
);
CREATE POLICY "comments_insert" ON task_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_delete" ON task_comments FOR DELETE USING (user_id = auth.uid());

-- Assignment rules policies
CREATE POLICY "rules_select" ON assignment_rules FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "rules_insert" ON assignment_rules FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "rules_update" ON assignment_rules FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "rules_delete" ON assignment_rules FOR DELETE USING (is_workspace_admin(workspace_id));

-- Transcripts policies
CREATE POLICY "transcripts_select" ON transcripts FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "transcripts_insert" ON transcripts FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_my_workspace_ids()) AND has_role(workspace_id, 'builder')
);

-- AI briefings policies
CREATE POLICY "briefings_select" ON ai_briefings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "briefings_insert" ON ai_briefings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "briefings_update" ON ai_briefings FOR UPDATE USING (user_id = auth.uid());

-- Activity log policies
CREATE POLICY "activity_select" ON activity_log FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- Notification configs policies
CREATE POLICY "notif_select" ON notification_configs FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "notif_insert" ON notification_configs FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "notif_update" ON notification_configs FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "notif_delete" ON notification_configs FOR DELETE USING (is_workspace_admin(workspace_id));

-- Subscriptions & usage policies
CREATE POLICY "subs_select" ON subscriptions FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "usage_select" ON usage_tracking FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- ============================================================
-- PART 3: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-set date_completed when task status -> done
CREATE OR REPLACE FUNCTION auto_complete_task()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.date_completed = NOW();
  END IF;
  IF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.date_completed = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_auto_complete BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION auto_complete_task();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-add workspace creator as owner
CREATE OR REPLACE FUNCTION auto_add_workspace_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_workspace_add_owner
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION auto_add_workspace_owner();

-- Activity log helper
CREATE OR REPLACE FUNCTION log_activity(
  ws_id UUID,
  u_id UUID,
  p_action activity_action,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO activity_log (workspace_id, user_id, action, target_type, target_id, metadata)
  VALUES (ws_id, u_id, p_action, p_target_type, p_target_id, p_metadata)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Task auto-log on status change
CREATE OR REPLACE FUNCTION log_task_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_activity(
      NEW.workspace_id,
      auth.uid(),
      CASE WHEN NEW.status = 'done' THEN 'task_completed'::activity_action
           ELSE 'task_updated'::activity_action END,
      'task',
      NEW.id,
      jsonb_build_object('field', 'status', 'old_value', OLD.status::text, 'new_value', NEW.status::text)
    );
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    PERFORM log_activity(
      NEW.workspace_id,
      auth.uid(),
      'task_assigned',
      'task',
      NEW.id,
      jsonb_build_object('old_assignee', OLD.assigned_to, 'new_assignee', NEW.assigned_to)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_log_changes
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_change();

-- Usage tracking increment
CREATE OR REPLACE FUNCTION increment_usage(ws_id UUID, field TEXT)
RETURNS VOID AS $$
DECLARE
  p_start TIMESTAMPTZ;
  p_end TIMESTAMPTZ;
BEGIN
  p_start := date_trunc('month', NOW());
  p_end := p_start + INTERVAL '1 month';
  INSERT INTO usage_tracking (workspace_id, period_start, period_end)
  VALUES (ws_id, p_start, p_end)
  ON CONFLICT (workspace_id, period_start) DO NOTHING;
  EXECUTE format(
    'UPDATE usage_tracking SET %I = %I + 1 WHERE workspace_id = $1 AND period_start = $2',
    field, field
  ) USING ws_id, p_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Smart assignment suggestion
CREATE OR REPLACE FUNCTION suggest_assignee(ws_id UUID, p_client_id UUID DEFAULT NULL, p_system_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  assignee_id UUID;
  current_hour INT;
BEGIN
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila');
  IF p_client_id IS NOT NULL THEN
    SELECT ar.assignee_id INTO assignee_id
    FROM assignment_rules ar JOIN clients c ON c.name = ar.condition_value AND c.id = p_client_id
    WHERE ar.workspace_id = ws_id AND ar.rule_type = 'time' AND ar.is_active = true AND current_hour >= 21
    ORDER BY ar.priority_order LIMIT 1;
    IF assignee_id IS NOT NULL THEN RETURN assignee_id; END IF;
    SELECT ar.assignee_id INTO assignee_id
    FROM assignment_rules ar JOIN clients c ON c.name = ar.condition_value AND c.id = p_client_id
    WHERE ar.workspace_id = ws_id AND ar.rule_type = 'client' AND ar.is_active = true
    ORDER BY ar.priority_order LIMIT 1;
    IF assignee_id IS NOT NULL THEN RETURN assignee_id; END IF;
  END IF;
  IF p_system_id IS NOT NULL THEN
    SELECT ar.assignee_id INTO assignee_id
    FROM assignment_rules ar JOIN systems s ON s.name = ar.condition_value AND s.id = p_system_id
    WHERE ar.workspace_id = ws_id AND ar.rule_type = 'system' AND ar.is_active = true
    ORDER BY ar.priority_order LIMIT 1;
    IF assignee_id IS NOT NULL THEN RETURN assignee_id; END IF;
  END IF;
  SELECT ar.assignee_id INTO assignee_id
  FROM assignment_rules ar
  WHERE ar.workspace_id = ws_id AND ar.rule_type = 'default' AND ar.is_active = true
  ORDER BY ar.priority_order LIMIT 1;
  RETURN assignee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Workspace stats (for dashboard)
CREATE OR REPLACE FUNCTION get_workspace_stats(ws_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_tasks', COUNT(*),
    'not_started', COUNT(*) FILTER (WHERE status = 'not_started'),
    'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'qa', COUNT(*) FILTER (WHERE status = 'qa'),
    'done', COUNT(*) FILTER (WHERE status = 'done'),
    'blocked', COUNT(*) FILTER (WHERE status = 'blocked'),
    'critical', COUNT(*) FILTER (WHERE priority = 'critical'),
    'overdue', COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done')),
    'completed_today', COUNT(*) FILTER (WHERE date_completed::date = CURRENT_DATE),
    'completed_this_week', COUNT(*) FILTER (WHERE date_completed >= date_trunc('week', NOW()))
  ) INTO result
  FROM tasks WHERE workspace_id = ws_id;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Team velocity (for analytics)
CREATE OR REPLACE FUNCTION get_team_velocity(ws_id UUID, days INT DEFAULT 30)
RETURNS TABLE (completion_date DATE, tasks_completed BIGINT, avg_completion_hours NUMERIC) AS $$
  SELECT
    date_completed::date AS completion_date,
    COUNT(*) AS tasks_completed,
    ROUND(AVG(EXTRACT(EPOCH FROM (date_completed - date_added)) / 3600)::numeric, 1) AS avg_completion_hours
  FROM tasks
  WHERE workspace_id = ws_id AND status = 'done' AND date_completed >= NOW() - (days || ' days')::interval
  GROUP BY date_completed::date
  ORDER BY completion_date DESC
$$ LANGUAGE sql SECURITY DEFINER STABLE;
