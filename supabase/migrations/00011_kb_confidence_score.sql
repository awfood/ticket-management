-- Add AI confidence score to knowledge base articles
-- Score 0-100 where:
--   90-100: High confidence — content derived directly from code analysis
--   70-89:  Medium confidence — content inferred from patterns and naming
--   50-69:  Low confidence — content partially guessed, needs human review
--   0-49:   Very low — placeholder content, must be reviewed

ALTER TABLE knowledge_base_articles
ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS confidence_notes text DEFAULT NULL;

-- Index for filtering by score
CREATE INDEX IF NOT EXISTS idx_kb_articles_confidence_score
ON knowledge_base_articles (confidence_score)
WHERE deleted_at IS NULL;

-- Composite index for common query: published + score
CREATE INDEX IF NOT EXISTS idx_kb_articles_published_score
ON knowledge_base_articles (is_published, confidence_score)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN knowledge_base_articles.confidence_score IS 'AI confidence score 0-100. NULL = not AI-generated. Lower scores need human review.';
COMMENT ON COLUMN knowledge_base_articles.confidence_notes IS 'Notes about what aspects of the article have lower confidence and why.';
