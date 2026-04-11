-- Add parent_comment_id for reply threading

ALTER TABLE ticket_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES ticket_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_parent ON ticket_comments(parent_comment_id);
