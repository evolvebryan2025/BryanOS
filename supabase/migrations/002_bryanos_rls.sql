-- ============================================================
-- BryanOS 1.0 — Row Level Security Policies
-- Every table is workspace-scoped via RLS
-- ============================================================

-- Enable RLS on all tables
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

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get all workspace IDs the current user belongs to
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user has at least the given role in a workspace
-- Role hierarchy: owner < admin < builder < viewer (lower = more permissions)
CREATE OR REPLACE FUNCTION has_role(ws_id UUID, required_role member_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = auth.uid()
      AND workspace_id = ws_id
      AND role <= required_role
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is owner or admin
CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = auth.uid()
      AND workspace_id = ws_id
      AND role IN ('owner', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS — own profile only
-- ============================================================
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- Users can also see profiles of people in their workspaces
CREATE POLICY "users_select_teammates" ON users
  FOR SELECT USING (
    id IN (
      SELECT wm.user_id FROM workspace_members wm
      WHERE wm.workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

-- ============================================================
-- WORKSPACES — members can read, owners/admins can update
-- ============================================================
CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT USING (id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT WITH CHECK (true); -- Anyone can create a workspace
CREATE POLICY "workspaces_update" ON workspaces
  FOR UPDATE USING (is_workspace_admin(id));
CREATE POLICY "workspaces_delete" ON workspaces
  FOR DELETE USING (has_role(id, 'owner'));

-- ============================================================
-- WORKSPACE MEMBERS — scoped to workspace
-- ============================================================
CREATE POLICY "members_select" ON workspace_members
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "members_insert" ON workspace_members
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "members_update" ON workspace_members
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "members_delete" ON workspace_members
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- ============================================================
-- CLIENTS — workspace-scoped, admin+ can write
-- ============================================================
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- ============================================================
-- SYSTEMS — workspace-scoped, admin+ can write
-- ============================================================
CREATE POLICY "systems_select" ON systems
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "systems_insert" ON systems
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "systems_update" ON systems
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "systems_delete" ON systems
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- ============================================================
-- TASKS — workspace-scoped, all members can read, builder+ can write
-- ============================================================
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids())
    AND has_role(workspace_id, 'builder')
  );
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    AND has_role(workspace_id, 'builder')
  );
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- ============================================================
-- TASK COMMENTS — workspace members can read, any member can write
-- ============================================================
CREATE POLICY "comments_select" ON task_comments
  FOR SELECT USING (
    task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT get_my_workspace_ids()))
  );
CREATE POLICY "comments_insert" ON task_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_delete" ON task_comments
  FOR DELETE USING (user_id = auth.uid()); -- Can only delete own comments

-- ============================================================
-- ASSIGNMENT RULES — workspace-scoped, admin+ can write
-- ============================================================
CREATE POLICY "rules_select" ON assignment_rules
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "rules_insert" ON assignment_rules
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "rules_update" ON assignment_rules
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "rules_delete" ON assignment_rules
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- ============================================================
-- TRANSCRIPTS — workspace-scoped
-- ============================================================
CREATE POLICY "transcripts_select" ON transcripts
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "transcripts_insert" ON transcripts
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids())
    AND has_role(workspace_id, 'builder')
  );

-- ============================================================
-- AI BRIEFINGS — user-scoped
-- ============================================================
CREATE POLICY "briefings_select" ON ai_briefings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "briefings_insert" ON ai_briefings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "briefings_update" ON ai_briefings
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- ACTIVITY LOG — workspace-scoped, read-only for members
-- ============================================================
CREATE POLICY "activity_select" ON activity_log
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
-- Inserts happen via server-side functions (SECURITY DEFINER)

-- ============================================================
-- NOTIFICATION CONFIGS — workspace-scoped, admin+ can manage
-- ============================================================
CREATE POLICY "notif_select" ON notification_configs
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "notif_insert" ON notification_configs
  FOR INSERT WITH CHECK (is_workspace_admin(workspace_id));
CREATE POLICY "notif_update" ON notification_configs
  FOR UPDATE USING (is_workspace_admin(workspace_id));
CREATE POLICY "notif_delete" ON notification_configs
  FOR DELETE USING (is_workspace_admin(workspace_id));

-- ============================================================
-- SUBSCRIPTIONS & USAGE — workspace-scoped, read-only
-- ============================================================
CREATE POLICY "subs_select" ON subscriptions
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
CREATE POLICY "usage_select" ON usage_tracking
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
