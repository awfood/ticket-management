-- AWFood Ticket Management - pgvector RPC Functions

------------------------------------------------------------
-- 1. Match similar tickets by embedding
------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_tickets(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  ticket_number text,
  title text,
  status text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.id,
    t.ticket_number,
    t.title,
    t.status,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM tickets t
  WHERE t.embedding IS NOT NULL
    AND t.deleted_at IS NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;

------------------------------------------------------------
-- 2. Match similar knowledge base articles by embedding
------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_knowledge_base_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base_articles kb
  WHERE kb.embedding IS NOT NULL
    AND kb.deleted_at IS NULL
    AND kb.is_published = true
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;

------------------------------------------------------------
-- 3. Dashboard stats helper
------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_org_id uuid DEFAULT NULL,
  p_days int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result json;
BEGIN
  WITH date_range AS (
    SELECT generate_series(
      (current_date - (p_days || ' days')::interval)::date,
      current_date,
      '1 day'::interval
    )::date AS day
  ),
  ticket_base AS (
    SELECT * FROM tickets
    WHERE deleted_at IS NULL
      AND (p_org_id IS NULL OR org_id = p_org_id)
  ),
  status_counts AS (
    SELECT status, count(*) AS count
    FROM ticket_base
    WHERE status NOT IN ('closed', 'cancelled')
    GROUP BY status
  ),
  priority_counts AS (
    SELECT priority, count(*) AS count
    FROM ticket_base
    WHERE status NOT IN ('closed', 'cancelled')
    GROUP BY priority
  ),
  daily_stats AS (
    SELECT
      d.day AS date,
      COALESCE(c.created, 0) AS created,
      COALESCE(r.resolved, 0) AS resolved
    FROM date_range d
    LEFT JOIN (
      SELECT created_at::date AS day, count(*) AS created
      FROM ticket_base
      WHERE created_at >= current_date - (p_days || ' days')::interval
      GROUP BY created_at::date
    ) c ON d.day = c.day
    LEFT JOIN (
      SELECT resolved_at::date AS day, count(*) AS resolved
      FROM ticket_base
      WHERE resolved_at >= current_date - (p_days || ' days')::interval
      GROUP BY resolved_at::date
    ) r ON d.day = r.day
    ORDER BY d.day
  ),
  sla_stats AS (
    SELECT
      count(*) FILTER (WHERE sla_breach = false AND status IN ('resolved', 'closed')) AS compliant,
      count(*) FILTER (WHERE status IN ('resolved', 'closed')) AS total_resolved
    FROM ticket_base
    WHERE resolved_at >= current_date - (p_days || ' days')::interval
  ),
  avg_times AS (
    SELECT
      COALESCE(avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600), 0) AS avg_first_response,
      COALESCE(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0) AS avg_resolution
    FROM ticket_base
    WHERE resolved_at IS NOT NULL
      AND resolved_at >= current_date - (p_days || ' days')::interval
  )
  SELECT json_build_object(
    'total_open', (SELECT COALESCE(sum(count), 0) FROM status_counts WHERE status = 'open'),
    'total_in_progress', (SELECT COALESCE(sum(count), 0) FROM status_counts WHERE status = 'in_progress'),
    'total_resolved_today', (SELECT count(*) FROM ticket_base WHERE resolved_at::date = current_date),
    'total_sla_breach', (SELECT count(*) FROM ticket_base WHERE sla_breach = true AND status NOT IN ('closed', 'cancelled')),
    'avg_first_response_hours', (SELECT round(avg_first_response::numeric, 1) FROM avg_times),
    'avg_resolution_hours', (SELECT round(avg_resolution::numeric, 1) FROM avg_times),
    'sla_compliance_rate', (SELECT CASE WHEN total_resolved > 0 THEN round((compliant::numeric / total_resolved) * 100, 1) ELSE 100 END FROM sla_stats),
    'tickets_by_status', (SELECT COALESCE(json_agg(json_build_object('status', status, 'count', count)), '[]'::json) FROM status_counts),
    'tickets_by_priority', (SELECT COALESCE(json_agg(json_build_object('priority', priority, 'count', count)), '[]'::json) FROM priority_counts),
    'tickets_over_time', (SELECT COALESCE(json_agg(json_build_object('date', date, 'created', created, 'resolved', resolved)), '[]'::json) FROM daily_stats)
  ) INTO result;

  RETURN result;
END;
$$;
