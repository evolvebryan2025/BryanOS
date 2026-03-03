-- 004_handoffs.sql
-- Build Handoff System — Simple delivery tracking for clients

-- Handoff status enum
CREATE TYPE handoff_status AS ENUM ('draft', 'sent', 'viewed', 'accepted');

-- Main handoffs table
CREATE TABLE handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  project_name TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  status handoff_status NOT NULL DEFAULT 'draft',
  access_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Index for fast token lookups (client access)
CREATE INDEX idx_handoffs_token ON handoffs(access_token);
CREATE INDEX idx_handoffs_status ON handoffs(status);
CREATE INDEX idx_handoffs_created ON handoffs(created_at DESC);
