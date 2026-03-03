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
