-- Migration: Add review system to knowledge base articles
-- Allows reviewing, approving, rejecting, and tracking feedback on articles

-- Add review fields to knowledge_base_articles
ALTER TABLE knowledge_base_articles
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helpful_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_helpful_count integer DEFAULT 0;

-- Index for review status filtering
CREATE INDEX IF NOT EXISTS idx_kb_review_status ON knowledge_base_articles(review_status);
CREATE INDEX IF NOT EXISTS idx_kb_slug ON knowledge_base_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_source ON knowledge_base_articles(source);
CREATE INDEX IF NOT EXISTS idx_kb_sort_order ON knowledge_base_articles(sort_order);

-- Create article feedback table for tracking individual feedback
CREATE TABLE IF NOT EXISTS knowledge_base_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  is_helpful boolean NOT NULL,
  comment text,
  user_identifier text, -- IP or session hash (not PII)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_feedback_article ON knowledge_base_feedback(article_id);

-- Create article revision history
CREATE TABLE IF NOT EXISTS knowledge_base_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  content_html text,
  changed_by uuid REFERENCES profiles(id),
  change_summary text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_revisions_article ON knowledge_base_revisions(article_id);

-- Add kb scopes to existing API keys table (for public API)
-- No schema change needed - scopes are stored as text[] and we'll just use 'kb.read' and 'kb.write'

-- RLS for feedback table
ALTER TABLE knowledge_base_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_revisions ENABLE ROW LEVEL SECURITY;

-- Feedback: anyone can insert, only internal can read all
CREATE POLICY "Anyone can submit feedback"
  ON knowledge_base_feedback FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Internal users can read all feedback"
  ON knowledge_base_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_internal = true
    )
  );

-- Revisions: only internal users
CREATE POLICY "Internal users manage revisions"
  ON knowledge_base_revisions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_internal = true
    )
  );

-- Service role bypass for API key access
CREATE POLICY "Service role full access feedback"
  ON knowledge_base_feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access revisions"
  ON knowledge_base_revisions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
