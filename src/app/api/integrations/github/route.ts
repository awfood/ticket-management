import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/integrations/encryption'
import { GitHubClient } from '@/lib/integrations/github/client'

function maskValue(value: string): string {
  if (value.length <= 4) return '****'
  return '****' + value.slice(-4)
}

async function requireInternalUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, error: 'Nao autorizado', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!profile?.is_internal) {
    return { user: null, error: 'Acesso restrito a usuarios internos', status: 403 }
  }

  return { user, error: null, status: 200 }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { user, error, status } = await requireInternalUser(supabase)
    if (!user) return NextResponse.json({ error }, { status })

    const { data: config } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('provider', 'github')
      .limit(1)
      .single()

    if (!config) {
      return NextResponse.json({ configured: false })
    }

    const safeConfig = {
      ...config,
      config: {
        ...config.config as Record<string, unknown>,
        access_token: config.config && (config.config as Record<string, string>).access_token
          ? maskValue('token')
          : undefined,
      },
    }

    return NextResponse.json({ configured: true, data: safeConfig })
  } catch (err) {
    console.error('Error in GET /api/integrations/github:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user, error, status } = await requireInternalUser(supabase)
    if (!user) return NextResponse.json({ error }, { status })

    const body = await request.json()
    const { access_token, owner, default_repo } = body

    if (!access_token || !owner) {
      return NextResponse.json(
        { error: 'Token de acesso e owner/organizacao sao obrigatorios' },
        { status: 400 }
      )
    }

    // Test connection before saving
    const client = new GitHubClient({ accessToken: access_token, owner })
    const testResult = await client.testConnection()

    if (!testResult.ok) {
      return NextResponse.json(
        { error: `Falha na conexao com o GitHub: ${testResult.error}` },
        { status: 400 }
      )
    }

    const encryptedToken = encrypt(access_token)

    const configData = {
      access_token: encryptedToken,
      owner,
      default_repo: default_repo || null,
    }

    // Check if config already exists
    const { data: existing } = await supabase
      .from('integration_configs')
      .select('id')
      .eq('provider', 'github')
      .limit(1)
      .single()

    let result
    if (existing) {
      const { data, error: updateError } = await supabase
        .from('integration_configs')
        .update({
          config: configData,
          is_active: true,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateError) throw updateError
      result = data
    } else {
      const { data, error: insertError } = await supabase
        .from('integration_configs')
        .insert({
          provider: 'github',
          config: configData,
          is_active: true,
          created_by: user.id,
          last_synced_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      result = data
    }

    return NextResponse.json({
      success: true,
      user: testResult.user,
      data: result,
    })
  } catch (err) {
    console.error('Error in POST /api/integrations/github:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { user, error, status } = await requireInternalUser(supabase)
    if (!user) return NextResponse.json({ error }, { status })

    const { error: deleteError } = await supabase
      .from('integration_configs')
      .delete()
      .eq('provider', 'github')

    if (deleteError) {
      console.error('Error deleting GitHub config:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao remover configuracao do GitHub' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/integrations/github:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
