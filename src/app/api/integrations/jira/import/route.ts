import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/integrations/encryption'
import { JiraClient, type JiraIssue } from '@/lib/integrations/jira/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!profile?.is_internal) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const body = await request.json()
  const { issueKeys, org_id, update_existing = false } = body as {
    issueKeys: string[]
    org_id?: string
    update_existing?: boolean
  }

  if (!issueKeys || !Array.isArray(issueKeys) || issueKeys.length === 0) {
    return NextResponse.json({ error: 'issueKeys obrigatorio (array de keys Jira)' }, { status: 400 })
  }

  if (issueKeys.length > 50) {
    return NextResponse.json({ error: 'Maximo 50 issues por importacao' }, { status: 400 })
  }

  // Get Jira config
  const serviceClient = await createServiceClient()
  const { data: config } = await serviceClient
    .from('integration_configs')
    .select('config')
    .eq('provider', 'jira')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!config) {
    return NextResponse.json({ error: 'Jira nao configurado' }, { status: 400 })
  }

  const jiraConfig = config.config as Record<string, string>
  let apiToken: string
  try {
    apiToken = decrypt(jiraConfig.api_token)
  } catch {
    return NextResponse.json({ error: 'Erro ao descriptografar credenciais' }, { status: 500 })
  }

  const client = new JiraClient({
    baseUrl: jiraConfig.base_url,
    email: jiraConfig.email,
    apiToken,
  })

  // Resolve org_id: use provided, or fall back to internal AWFood org
  const resolvedOrgId = org_id || '00000000-0000-0000-0000-000000000001'

  // Check already imported — get full link data for update mode
  const { data: existingLinks } = await serviceClient
    .from('ticket_external_links')
    .select('external_id, ticket_id')
    .eq('provider', 'jira')
    .in('external_id', issueKeys)

  const existingMap = new Map<string, string>() // jira_key → ticket_id
  for (const link of existingLinks ?? []) {
    existingMap.set(link.external_id, link.ticket_id)
  }

  const keysToImport = issueKeys.filter((k) => !existingMap.has(k))
  const keysToUpdate = update_existing
    ? issueKeys.filter((k) => existingMap.has(k))
    : []

  if (keysToImport.length === 0 && keysToUpdate.length === 0) {
    return NextResponse.json({
      data: {
        imported: 0,
        updated: 0,
        skipped: issueKeys.length,
        failed: 0,
        tickets: [],
        message: 'Todas as issues ja foram importadas anteriormente',
      },
    })
  }

  // Fetch full issue data from Jira for all needed keys
  const allKeysToFetch = [...keysToImport, ...keysToUpdate]
  const issues: JiraIssue[] = []
  for (const key of allKeysToFetch) {
    try {
      const issue = await client.getIssue(key)
      issues.push(issue)
    } catch (err) {
      console.error(`[jira-import] Erro ao buscar issue ${key}:`, err)
    }
  }

  const importedTickets: { id: string; ticket_number: string; jira_key: string; action: 'created' | 'updated' }[] = []

  for (const issue of issues) {
    try {
      const priority = mapJiraPriority(issue.priority)
      const category = mapIssueTypeToCategory(issue.issueType)
      const existingTicketId = existingMap.get(issue.key)

      if (existingTicketId) {
        // UPDATE existing ticket
        const { data: updated } = await supabase
          .from('tickets')
          .update({
            title: issue.summary,
            description: issue.description ?? '',
            description_html: issue.descriptionHtml ?? issue.description ?? '',
            status: mapJiraStatus(issue.status),
            priority,
            category,
            updated_at: new Date().toISOString(),
            metadata: {
              source: 'jira_import',
              jira_key: issue.key,
              jira_status: issue.status,
              jira_type: issue.issueType,
              jira_assignee: issue.assignee,
              jira_reporter: issue.reporter,
              jira_created: issue.created,
              last_synced_at: new Date().toISOString(),
            },
          })
          .eq('id', existingTicketId)
          .select('id, ticket_number')
          .single()

        if (updated) {
          // Update external link status
          await supabase
            .from('ticket_external_links')
            .update({ external_status: issue.status, last_synced_at: new Date().toISOString() })
            .eq('ticket_id', existingTicketId)
            .eq('provider', 'jira')

          await supabase.from('ticket_history').insert({
            ticket_id: existingTicketId,
            changed_by: user.id,
            field_name: 'sync',
            old_value: null,
            new_value: `Atualizado do Jira: ${issue.key}`,
          })

          importedTickets.push({
            id: updated.id,
            ticket_number: updated.ticket_number,
            jira_key: issue.key,
            action: 'updated',
          })
        }
      } else {
        // CREATE new ticket
        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .insert({
            title: issue.summary,
            description: issue.description ?? `Importado do Jira: ${issue.key}`,
            description_html: issue.descriptionHtml ?? issue.description ?? `<p>Importado do Jira: ${issue.key}</p>`,
            status: mapJiraStatus(issue.status),
            priority,
            category,
            org_id: resolvedOrgId,
            created_by: user.id,
            tags: ['jira-import'],
            metadata: {
              source: 'jira_import',
              jira_key: issue.key,
              jira_status: issue.status,
              jira_type: issue.issueType,
              jira_assignee: issue.assignee,
              jira_reporter: issue.reporter,
              jira_created: issue.created,
            },
          })
          .select('id, ticket_number')
          .single()

        if (ticketError || !ticket) {
          console.error(`[jira-import] Erro ao criar ticket para ${issue.key}:`, ticketError)
          continue
        }

        await supabase.from('ticket_external_links').insert({
          ticket_id: ticket.id,
          provider: 'jira',
          external_id: issue.key,
          external_url: issue.url,
          external_status: issue.status,
          link_type: 'created_from',
          sync_enabled: true,
          metadata: { jira_id: issue.id, imported_at: new Date().toISOString() },
        })

        await supabase.from('ticket_history').insert({
          ticket_id: ticket.id,
          changed_by: user.id,
          field_name: 'import',
          old_value: null,
          new_value: `Importado do Jira: ${issue.key}`,
        })

        importedTickets.push({
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          jira_key: issue.key,
          action: 'created',
        })
      }
    } catch (err) {
      console.error(`[jira-import] Erro inesperado para ${issue.key}:`, err)
    }
  }

  const created = importedTickets.filter((t) => t.action === 'created').length
  const updated = importedTickets.filter((t) => t.action === 'updated').length

  return NextResponse.json({
    data: {
      imported: created,
      updated,
      skipped: issueKeys.length - keysToImport.length - keysToUpdate.length,
      failed: allKeysToFetch.length - importedTickets.length,
      tickets: importedTickets,
    },
  })
}

function mapJiraPriority(priority: string | null): string {
  if (!priority) return 'medium'
  const p = priority.toLowerCase()
  if (p === 'highest' || p === 'critical') return 'critical'
  if (p === 'high') return 'high'
  if (p === 'low' || p === 'lowest') return 'low'
  return 'medium'
}

function mapJiraStatus(status: string): string {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'closed' || s === 'resolved') return 'resolved'
  if (s === 'in progress' || s === 'in review') return 'in_progress'
  if (s === 'waiting' || s === 'blocked') return 'waiting_internal'
  if (s === 'cancelled' || s === 'won\'t do') return 'cancelled'
  return 'open'
}

function mapIssueTypeToCategory(issueType: string): string {
  const t = issueType.toLowerCase()
  if (t === 'bug') return 'bug'
  if (t === 'story' || t === 'feature') return 'feature_request'
  if (t === 'support' || t === 'service request') return 'support'
  return 'support'
}
