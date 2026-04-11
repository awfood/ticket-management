import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/integrations/encryption'
import { JiraClient } from '@/lib/integrations/jira/client'

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl
  const project = searchParams.get('project')
  const q = searchParams.get('q')
  const maxResults = Math.min(50, parseInt(searchParams.get('max') ?? '20', 10))

  if (!project) {
    return NextResponse.json({ error: 'Parametro project obrigatorio' }, { status: 400 })
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

  // Build JQL
  let jql = `project = "${project}" ORDER BY updated DESC`
  if (q) {
    jql = `project = "${project}" AND (summary ~ "${q}" OR description ~ "${q}") ORDER BY updated DESC`
  }

  try {
    const issues = await client.searchIssues(jql)

    // Check which ones are already imported
    const issueKeys = issues.map((i) => i.key)
    const { data: existingLinks } = await serviceClient
      .from('ticket_external_links')
      .select('external_id')
      .eq('provider', 'jira')
      .in('external_id', issueKeys)

    const importedKeys = new Set((existingLinks ?? []).map((l) => l.external_id))

    const enriched = issues.slice(0, maxResults).map((issue) => ({
      ...issue,
      already_imported: importedKeys.has(issue.key),
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar issues'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
