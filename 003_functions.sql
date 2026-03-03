-- 003_functions.sql

-- Increment usage tracking counters
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

-- Increment video view count
CREATE OR REPLACE FUNCTION increment_view_count(vid UUID)
RETURNS VOID AS $$
  UPDATE videos SET view_count = view_count + 1 WHERE id = vid;
$$ LANGUAGE sql SECURITY DEFINER;
