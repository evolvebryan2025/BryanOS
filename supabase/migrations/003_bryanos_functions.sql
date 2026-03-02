-- ============================================================
-- BryanOS 1.0 — Database Functions & Triggers
-- ============================================================

-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-SET date_completed WHEN TASK STATUS → DONE
-- ============================================================

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

CREATE TRIGGER trg_task_auto_complete BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION auto_complete_task();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

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

-- ============================================================
-- AUTO-ADD WORKSPACE CREATOR AS OWNER
-- ============================================================

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

-- ============================================================
-- ACTIVITY LOG HELPER (called from server-side)
-- ============================================================

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

-- ============================================================
-- TASK AUTO-LOG ON STATUS CHANGE
-- ============================================================

CREATE OR REPLACE FUNCTION log_task_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_activity(
      NEW.workspace_id,
      auth.uid(),
      CASE WHEN NEW.status = 'done' THEN 'task_completed'::activity_action
           ELSE 'task_updated'::activity_action END,
      'task',
      NEW.id,
      jsonb_build_object(
        'field', 'status',
        'old_value', OLD.status::text,
        'new_value', NEW.status::text
      )
    );
  END IF;

  -- Log assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    PERFORM log_activity(
      NEW.workspace_id,
      auth.uid(),
      'task_assigned',
      'task',
      NEW.id,
      jsonb_build_object(
        'old_assignee', OLD.assigned_to,
        'new_assignee', NEW.assigned_to
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_log_changes
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_change();

-- ============================================================
-- USAGE TRACKING INCREMENT
-- ============================================================

CREATE OR REPLACE FUNCTION increment_usage(
  ws_id UUID,
  field TEXT
) RETURNS VOID AS $$
DECLARE
  p_start TIMESTAMPTZ;
  p_end TIMESTAMPTZ;
BEGIN
  -- Current billing period (monthly)
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

-- ============================================================
-- SMART ASSIGNMENT SUGGESTION
-- ============================================================

CREATE OR REPLACE FUNCTION suggest_assignee(
  ws_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_system_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  assignee_id UUID;
  current_hour INT;
BEGIN
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila');

  -- Priority 1: Client-based rule
  IF p_client_id IS NOT NULL THEN
    -- Check time-based override first
    SELECT ar.assignee_id INTO assignee_id
    FROM assignment_rules ar
    JOIN clients c ON c.name = ar.condition_value AND c.id = p_client_id
    WHERE ar.workspace_id = ws_id
      AND ar.rule_type = 'time'
      AND ar.is_active = true
      AND current_hour >= 21
    ORDER BY ar.priority_order
    LIMIT 1;

    IF assignee_id IS NOT NULL THEN RETURN assignee_id; END IF;

    -- Standard client rule
    SELECT ar.assignee_id INTO assignee_id
    FROM assignment_rules ar
    JOIN clients c ON c.name = ar.condition_value AND c.id = p_client_id
    WHERE ar.workspace_id = ws_id
      AND ar.rule_type = 'client'
      AND ar.is_active = true
    ORDER BY ar.priority_order
    LIMIT 1;

    IF assignee_id IS NOT NULL THEN RETURN assignee_id; END IF;
  END IF;

  -- Priority 2: System-based rule
  IF p_system_id IS NOT NULL THEN
    SELECT ar.assignee_id INTO assignee_id
    FROM assignment_rules ar
    JOIN systems s ON s.name = ar.condition_value AND s.id = p_system_id
    WHERE ar.workspace_id = ws_id
      AND ar.rule_type = 'system'
      AND ar.is_active = true
    ORDER BY ar.priority_order
    LIMIT 1;

    IF assignee_id IS NOT NULL THEN RETURN assignee_id; END IF;
  END IF;

  -- Priority 3: Default rule
  SELECT ar.assignee_id INTO assignee_id
  FROM assignment_rules ar
  WHERE ar.workspace_id = ws_id
    AND ar.rule_type = 'default'
    AND ar.is_active = true
  ORDER BY ar.priority_order
  LIMIT 1;

  RETURN assignee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- WORKSPACE STATS (for dashboard)
-- ============================================================

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
  FROM tasks
  WHERE workspace_id = ws_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- TEAM VELOCITY (for analytics)
-- ============================================================

CREATE OR REPLACE FUNCTION get_team_velocity(ws_id UUID, days INT DEFAULT 30)
RETURNS TABLE (
  completion_date DATE,
  tasks_completed BIGINT,
  avg_completion_hours NUMERIC
) AS $$
  SELECT
    date_completed::date AS completion_date,
    COUNT(*) AS tasks_completed,
    ROUND(AVG(EXTRACT(EPOCH FROM (date_completed - date_added)) / 3600)::numeric, 1) AS avg_completion_hours
  FROM tasks
  WHERE workspace_id = ws_id
    AND status = 'done'
    AND date_completed >= NOW() - (days || ' days')::interval
  GROUP BY date_completed::date
  ORDER BY completion_date DESC
$$ LANGUAGE sql SECURITY DEFINER STABLE;
