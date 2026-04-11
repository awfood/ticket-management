import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/integrations/encryption'
import { GitHubClient } from '@/lib/integrations/github/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { ticketId, repo } = body

    if (!ticketId || !repo) {
      return NextResponse.json(
        { error: 'ticketId e repo sao obrigatorios' },
        { status: 400 }
      )
    }

    // Fetch the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .is('deleted_at', null)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket nao encontrado' },
        { status: 404 }
      )
    }

    // Get GitHub config with decrypted credentials
    const serviceClient = await createServiceClient()
    const { data: config } = await serviceClient
      .from('integration_configs')
      .select('config')
      .eq('provider', 'github')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!config) {
      return NextResponse.json(
        { error: 'Integracao com GitHub nao configurada' },
        { status: 400 }
      )
    }

    const ghConfig = config.config as Record<string, string>
    let accessToken: string
    try {
      accessToken = decrypt(ghConfig.access_token)
    } catch {
      return NextResponse.json(
        { error: 'Erro ao descriptografar credenciais do GitHub' },
        { status: 500 }
      )
    }

    const client = new GitHubClient({
      accessToken,
      owner: ghConfig.owner,
    })

    // Build issue body
    const bodyParts: string[] = [
      `**Ticket:** ${ticket.ticket_number}`,
      '',
      ticket.description,
    ]

    if (ticket.steps_to_reproduce) {
      bodyParts.push('', '## Passos para reproduzir', ticket.steps_to_reproduce)
    }
    if (ticket.expected_behavior) {
      bodyParts.push('', '## Comportamento esperado', ticket.expected_behavior)
    }
    if (ticket.actual_behavior) {
      bodyParts.push('', '## Comportamento atual', ticket.actual_behavior)
    }
    if (ticket.affected_service) {
      bodyParts.push('', `**Servico afetado:** ${ticket.affected_service}`)
    }

    // Map category to labels
    const labels: string[] = []
    if (ticket.category === 'bug') labels.push('bug')
    else if (ticket.category === 'feature_request') labels.push('enhancement')
    if (ticket.priority === 'critical' || ticket.priority === 'high') {
      labels.push(`priority:${ticket.priority}`)
    }

    const issue = await client.createIssue(repo, {
      title: `[${ticket.ticket_number}] ${ticket.title}`,
      body: bodyParts.join('\n'),
      labels,
    })

    // Create the external link record
    const { data: link, error: linkError } = await supabase
      .from('ticket_external_links')
      .insert({
        ticket_id: ticketId,
        provider: 'github',
        external_id: `${ghConfig.owner}/${repo}#${issue.number}`,
        external_url: issue.url,
        external_status: issue.state,
        link_type: 'created_from',
        sync_enabled: true,
        metadata: { github_id: issue.id, repo, owner: ghConfig.owner },
      })
      .select('*')
      .single()

    if (linkError) {
      console.error('Error creating external link:', linkError)
    }

    // Add history entry
    await supabase.from('ticket_history').insert({
      ticket_id: ticketId,
      changed_by: user.id,
      field_name: 'external_link',
      old_value: null,
      new_value: `github:${ghConfig.owner}/${repo}#${issue.number}`,
    })

    return NextResponse.json({ issue, link }, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/integrations/github/issues:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
