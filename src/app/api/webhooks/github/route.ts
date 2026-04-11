import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHmac, timingSafeEqual } from 'crypto'

function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false

  const expected = 'sha256=' +
    createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}

interface GitHubWebhookIssuePayload {
  action: string
  issue: {
    number: number
    title: string
    state: 'open' | 'closed'
    html_url: string
    user: { login: string }
  }
  repository: {
    name: string
    full_name: string
    owner: { login: string }
  }
}

interface GitHubWebhookPRPayload {
  action: string
  pull_request: {
    number: number
    title: string
    state: 'open' | 'closed'
    merged: boolean
    html_url: string
    user: { login: string }
  }
  repository: {
    name: string
    full_name: string
    owner: { login: string }
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const event = request.headers.get('X-GitHub-Event')
    const signature = request.headers.get('X-Hub-Signature-256')

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
    if (webhookSecret) {
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json(
          { error: 'Assinatura do webhook invalida' },
          { status: 401 }
        )
      }
    }

    const body = JSON.parse(rawBody)

    const supabase = await createServiceClient()

    if (event === 'issues') {
      return handleIssueEvent(supabase, body as GitHubWebhookIssuePayload)
    }

    if (event === 'pull_request') {
      return handlePREvent(supabase, body as GitHubWebhookPRPayload)
    }

    // Unhandled event type — acknowledge
    return NextResponse.json({ ok: true, event, handled: false })
  } catch (err) {
    console.error('Error in POST /api/webhooks/github:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function handleIssueEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  payload: GitHubWebhookIssuePayload
) {
  const externalId = `${payload.repository.full_name}#${payload.issue.number}`
  const newStatus = payload.issue.state

  const { data: links } = await supabase
    .from('ticket_external_links')
    .select('id, ticket_id, external_status')
    .eq('provider', 'github')
    .eq('external_id', externalId)
    .eq('sync_enabled', true)

  if (!links || links.length === 0) {
    return NextResponse.json({ ok: true, matched: 0 })
  }

  for (const link of links) {
    if (newStatus !== link.external_status) {
      await supabase
        .from('ticket_external_links')
        .update({
          external_status: newStatus,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', link.id)

      const commentBody = `Issue GitHub **${externalId}** ${payload.action}: status agora e **${newStatus}**`

      await supabase.from('ticket_comments').insert({
        ticket_id: link.ticket_id,
        author_id: null,
        body: commentBody,
        is_internal: true,
        comment_type: 'system',
        metadata: {
          source: 'github_webhook',
          event: 'issues',
          action: payload.action,
          external_id: externalId,
        },
      })
    }
  }

  return NextResponse.json({ ok: true, matched: links.length })
}

async function handlePREvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  payload: GitHubWebhookPRPayload
) {
  // Check if any linked ticket mentions this repo
  const repoName = payload.repository.full_name
  const prNumber = payload.pull_request.number
  const prState = payload.pull_request.merged ? 'merged' : payload.pull_request.state

  // Search for links that reference this repo in metadata
  const { data: links } = await supabase
    .from('ticket_external_links')
    .select('id, ticket_id')
    .eq('provider', 'github')
    .eq('sync_enabled', true)
    .like('external_id', `${repoName}#%`)

  if (!links || links.length === 0) {
    return NextResponse.json({ ok: true, matched: 0 })
  }

  for (const link of links) {
    const commentBody = `Pull Request **${repoName}#${prNumber}** (${payload.pull_request.title}) ${payload.action}: status **${prState}**`

    await supabase.from('ticket_comments').insert({
      ticket_id: link.ticket_id,
      author_id: null,
      body: commentBody,
      is_internal: true,
      comment_type: 'system',
      metadata: {
        source: 'github_webhook',
        event: 'pull_request',
        action: payload.action,
        pr_number: prNumber,
        repo: repoName,
      },
    })
  }

  return NextResponse.json({ ok: true, matched: links.length })
}
