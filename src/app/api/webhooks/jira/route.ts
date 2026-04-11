import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface JiraWebhookPayload {
  webhookEvent: string
  issue?: {
    id: string
    key: string
    fields: {
      status: { name: string }
      summary: string
      assignee?: { displayName: string } | null
      priority?: { name: string } | null
    }
  }
  changelog?: {
    items: Array<{
      field: string
      fromString: string | null
      toString: string | null
    }>
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as JiraWebhookPayload

    // Validate basic payload structure
    if (!body.webhookEvent || !body.issue) {
      return NextResponse.json(
        { error: 'Payload invalido: webhookEvent e issue sao obrigatorios' },
        { status: 400 }
      )
    }

    const issueKey = body.issue.key
    const newStatus = body.issue.fields.status?.name ?? null

    // Use service client since webhooks are unauthenticated
    const supabase = await createServiceClient()

    // Find linked tickets by external_id
    const { data: links, error: linkError } = await supabase
      .from('ticket_external_links')
      .select('id, ticket_id, external_status')
      .eq('provider', 'jira')
      .eq('external_id', issueKey)
      .eq('sync_enabled', true)

    if (linkError) {
      console.error('Error fetching links for Jira webhook:', linkError)
      return NextResponse.json(
        { error: 'Erro ao buscar links' },
        { status: 500 }
      )
    }

    if (!links || links.length === 0) {
      // No linked tickets found — this is normal, just acknowledge
      return NextResponse.json({ ok: true, matched: 0 })
    }

    // Determine what changed
    const statusChange = body.changelog?.items.find(
      (item) => item.field === 'status'
    )

    for (const link of links) {
      // Update external status on the link
      if (newStatus && newStatus !== link.external_status) {
        await supabase
          .from('ticket_external_links')
          .update({
            external_status: newStatus,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', link.id)
      }

      // Add system comment on the ticket if status changed
      if (statusChange) {
        const commentBody = `Status da issue Jira **${issueKey}** alterado: ${statusChange.fromString ?? '(nenhum)'} → ${statusChange.toString ?? '(nenhum)'}`

        await supabase.from('ticket_comments').insert({
          ticket_id: link.ticket_id,
          author_id: null,
          body: commentBody,
          is_internal: true,
          comment_type: 'system',
          metadata: {
            source: 'jira_webhook',
            event: body.webhookEvent,
            issue_key: issueKey,
          },
        })
      }
    }

    return NextResponse.json({ ok: true, matched: links.length })
  } catch (err) {
    console.error('Error in POST /api/webhooks/jira:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
