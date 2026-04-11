import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/integrations/encryption'
import { JiraClient } from '@/lib/integrations/jira/client'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    // Use service client to bypass RLS for reading encrypted credentials
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

    const projects = await client.getProjects()

    return NextResponse.json(projects)
  } catch (err) {
    console.error('Error in GET /api/integrations/jira/projects:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
