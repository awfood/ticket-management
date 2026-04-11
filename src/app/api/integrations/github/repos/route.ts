import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/integrations/encryption'
import { GitHubClient } from '@/lib/integrations/github/client'

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

    const repos = await client.getRepos()

    return NextResponse.json(repos)
  } catch (err) {
    console.error('Error in GET /api/integrations/github/repos:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
