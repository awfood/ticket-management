import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/integrations/encryption'
import { JiraClient } from '@/lib/integrations/jira/client'

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
    const { ticketId, projectKey, issueType } = body

    if (!ticketId || !projectKey) {
      return NextResponse.json(
        { error: 'ticketId e projectKey sao obrigatorios' },
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

    // Get Jira config with decrypted credentials
    const serviceClient = await createServiceClient()
    const { data: config } = await serviceClient
      .from('integration_configs')
      .select('config')
      .eq('provider', 'jira')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!config) {
      return NextResponse.json(
        { error: 'Integracao com Jira nao configurada' },
        { status: 400 }
      )
    }

    const jiraConfig = config.config as Record<string, string>
    let apiToken: string
    try {
      apiToken = decrypt(jiraConfig.api_token)
    } catch {
      return NextResponse.json(
        { error: 'Erro ao descriptografar credenciais do Jira' },
        { status: 500 }
      )
    }

    const client = new JiraClient({
      baseUrl: jiraConfig.base_url,
      email: jiraConfig.email,
      apiToken,
    })

    // Build description for the Jira issue
    const descriptionParts: string[] = [
      `Ticket: ${ticket.ticket_number}`,
      '',
      ticket.description,
    ]

    if (ticket.steps_to_reproduce) {
      descriptionParts.push('', 'Passos para reproduzir:', ticket.steps_to_reproduce)
    }
    if (ticket.expected_behavior) {
      descriptionParts.push('', 'Comportamento esperado:', ticket.expected_behavior)
    }
    if (ticket.actual_behavior) {
      descriptionParts.push('', 'Comportamento atual:', ticket.actual_behavior)
    }
    if (ticket.affected_service) {
      descriptionParts.push('', `Servico afetado: ${ticket.affected_service}`)
    }

    const issue = await client.createIssue({
      projectKey,
      summary: `[${ticket.ticket_number}] ${ticket.title}`,
      description: descriptionParts.join('\n'),
      issueType: issueType ?? 'Task',
      priority: mapPriority(ticket.priority),
    })

    // Create the external link record
    const { data: link, error: linkError } = await supabase
      .from('ticket_external_links')
      .insert({
        ticket_id: ticketId,
        provider: 'jira',
        external_id: issue.key,
        external_url: issue.url,
        external_status: issue.status,
        link_type: 'created_from',
        sync_enabled: true,
        metadata: { jira_id: issue.id, project_key: projectKey },
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
      new_value: `jira:${issue.key}`,
    })

    return NextResponse.json({ issue, link }, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/integrations/jira/issues:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function mapPriority(priority: string | null): string | undefined {
  switch (priority) {
    case 'critical':
      return 'Highest'
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    default:
      return undefined
  }
}
