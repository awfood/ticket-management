// ============================================================
// Similar Ticket Finder (pgvector cosine similarity)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TicketStatus } from '@/types'

export interface SimilarTicket {
  id: string
  ticket_number: string
  title: string
  status: TicketStatus
  similarity: number
}

const SIMILARITY_THRESHOLD = 0.7
const DEFAULT_LIMIT = 5

/**
 * Finds tickets similar to the given embedding using pgvector cosine similarity.
 *
 * Requires a Supabase RPC function `match_tickets` defined as:
 *
 * ```sql
 * CREATE OR REPLACE FUNCTION match_tickets(
 *   query_embedding vector(1536),
 *   match_threshold float DEFAULT 0.7,
 *   match_count int DEFAULT 5
 * )
 * RETURNS TABLE (
 *   id uuid,
 *   ticket_number text,
 *   title text,
 *   status text,
 *   similarity float
 * )
 * LANGUAGE sql STABLE
 * AS $$
 *   SELECT
 *     t.id,
 *     t.ticket_number,
 *     t.title,
 *     t.status,
 *     1 - (t.embedding <=> query_embedding) AS similarity
 *   FROM tickets t
 *   WHERE t.embedding IS NOT NULL
 *     AND t.deleted_at IS NULL
 *     AND 1 - (t.embedding <=> query_embedding) > match_threshold
 *   ORDER BY t.embedding <=> query_embedding
 *   LIMIT match_count;
 * $$;
 * ```
 */
export async function findSimilarTickets(
  supabase: SupabaseClient,
  embedding: number[],
  limit?: number
): Promise<SimilarTicket[]> {
  const matchCount = limit ?? DEFAULT_LIMIT

  const { data, error } = await supabase.rpc('match_tickets', {
    query_embedding: embedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: matchCount,
  })

  if (error) {
    throw new Error(`Failed to find similar tickets: ${error.message}`)
  }

  if (!data || !Array.isArray(data)) {
    return []
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    ticket_number: String(row.ticket_number),
    title: String(row.title),
    status: row.status as TicketStatus,
    similarity: Number(row.similarity),
  }))
}

/**
 * Generates an embedding vector for the given text using
 * OpenAI text-embedding-3-small.
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('Cannot generate embedding for empty text.')
  }
  if (!apiKey) {
    throw new Error('OpenAI API key is required for embedding generation.')
  }

  // Truncate to ~8000 tokens (~32000 chars) to stay within model limits
  const truncated = text.slice(0, 32_000)

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncated,
    }),
  })

  if (!response.ok) {
    let errorMessage: string
    try {
      const errorBody = (await response.json()) as {
        error?: { message?: string }
      }
      errorMessage =
        errorBody.error?.message ?? `HTTP ${response.status}`
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`
    }
    throw new Error(`OpenAI Embeddings API error: ${errorMessage}`)
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>
  }

  const embedding = data.data[0]?.embedding
  if (!embedding) {
    throw new Error('No embedding returned from OpenAI API.')
  }

  return embedding
}
