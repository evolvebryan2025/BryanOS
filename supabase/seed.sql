-- ============================================================
-- BryanOS 1.0 — Seed Data
-- Run AFTER creating a workspace and signing up as the owner
-- Replace the UUIDs below with real values from your Supabase dashboard
-- ============================================================

-- INSTRUCTIONS:
-- 1. Sign up at your BryanOS app (creates user in auth.users + public.users)
-- 2. Create a workspace via the app (auto-adds you as owner)
-- 3. Copy your workspace_id and user IDs below
-- 4. Run this in Supabase SQL Editor

-- ============================================================
-- EXAMPLE: Replace these with your real IDs
-- ============================================================

-- DO SET workspace_id = 'YOUR-WORKSPACE-UUID';
-- DO SET bryan_id = 'YOUR-USER-UUID';

-- ============================================================
-- SYSTEMS (platforms your team works on)
-- ============================================================

-- INSERT INTO systems (workspace_id, name) VALUES
--   (workspace_id, 'GHL'),
--   (workspace_id, 'n8n'),
--   (workspace_id, 'Web App'),
--   (workspace_id, 'Voice Agent'),
--   (workspace_id, 'Cold Email'),
--   (workspace_id, 'Antigravity'),
--   (workspace_id, 'Claude Code');

-- ============================================================
-- CLIENTS
-- ============================================================

-- INSERT INTO clients (workspace_id, name, priority_level) VALUES
--   (workspace_id, 'Prince', 'high'),
--   (workspace_id, 'Kyle', 'high'),
--   (workspace_id, 'Juan', 'medium'),
--   (workspace_id, 'Thomas', 'medium');

-- ============================================================
-- ASSIGNMENT RULES
-- ============================================================

-- After inviting team members and getting their user IDs:

-- INSERT INTO assignment_rules (workspace_id, rule_type, condition_value, assignee_id, priority_order) VALUES
--   (workspace_id, 'client', 'Prince', vee_id, 1),
--   (workspace_id, 'client', 'Kyle', lee_id, 1),
--   (workspace_id, 'client', 'Juan', adam_id, 1),
--   (workspace_id, 'time', 'Prince + after 9pm', john_id, 1),
--   (workspace_id, 'system', 'GHL', adam_id, 2),
--   (workspace_id, 'system', 'n8n', vee_id, 2),
--   (workspace_id, 'system', 'Web App', jameel_id, 2),
--   (workspace_id, 'default', 'New Client', jameel_id, 3);

-- ============================================================
-- NOTIFICATION CONFIGS
-- ============================================================

-- INSERT INTO notification_configs (workspace_id, channel, webhook_url, config) VALUES
--   (workspace_id, 'webhook', 'https://madeeas.app.n8n.cloud/webhook/bryanOS', '{"events": ["task_created", "task_completed", "transcript_processed"]}'),
--   (workspace_id, 'telegram', NULL, '{"bot_token": "YOUR_BOT_TOKEN", "chat_id": "YOUR_CHAT_ID"}');
