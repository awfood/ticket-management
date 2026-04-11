import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/integrations/encryption'
import { createAIProvider } from '@/lib/ai/provider'
import type { AIProvider } from '@/types'

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

    const { data: settings } = await supabase
      .from('ai_settings')
      .select('*')
      .order('created_at', { ascending: false })

    if (!settings || settings.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Mask API keys
    const safeSettings = settings.map((s) => ({
      ...s,
      api_key_encrypted: maskValue(s.api_key_encrypted),
    }))

    // Get usage stats
    const { data: analysisStats } = await supabase
      .from('ai_analysis_results')
      .select('tokens_used, cost_usd')

    const totalAnalyses = analysisStats?.length ?? 0
    const totalTokens = analysisStats?.reduce(
      (sum, r) => sum + (r.tokens_used ?? 0),
      0
    ) ?? 0
    const totalCost = analysisStats?.reduce(
      (sum, r) => sum + (r.cost_usd ?? 0),
      0
    ) ?? 0

    return NextResponse.json({
      data: safeSettings,
      stats: {
        total_analyses: totalAnalyses,
        total_tokens: totalTokens,
        estimated_cost_usd: Math.round(totalCost * 100) / 100,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/ai/settings:', err)
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
    const { provider, api_key, default_model, is_active } = body

    if (!provider || !api_key) {
      return NextResponse.json(
        { error: 'Provedor e chave de API sao obrigatorios' },
        { status: 400 }
      )
    }

    const validProviders: AIProvider[] = ['openrouter', 'claude', 'openai']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Provedor invalido. Use: openrouter, claude ou openai' },
        { status: 400 }
      )
    }

    // Test connection with a simple chat call
    try {
      const aiProvider = createAIProvider(provider, api_key)
      await aiProvider.chat([
        { role: 'user', content: 'Responda apenas com "ok".' },
      ], { maxTokens: 10 })
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : 'Erro desconhecido'
      return NextResponse.json(
        { error: `Falha ao testar provedor de IA: ${message}` },
        { status: 400 }
      )
    }

    const encryptedKey = encrypt(api_key)

    // Check if this provider already has settings
    const { data: existing } = await supabase
      .from('ai_settings')
      .select('id')
      .eq('provider', provider)
      .limit(1)
      .single()

    let result
    if (existing) {
      const { data, error: updateError } = await supabase
        .from('ai_settings')
        .update({
          api_key_encrypted: encryptedKey,
          default_model: default_model || null,
          is_active: is_active !== undefined ? is_active : true,
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateError) throw updateError
      result = data
    } else {
      const { data, error: insertError } = await supabase
        .from('ai_settings')
        .insert({
          provider,
          api_key_encrypted: encryptedKey,
          default_model: default_model || null,
          is_active: is_active !== undefined ? is_active : true,
          created_by: user.id,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      result = data
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        api_key_encrypted: maskValue(result.api_key_encrypted),
      },
    })
  } catch (err) {
    console.error('Error in POST /api/ai/settings:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user, error, status } = await requireInternalUser(supabase)
    if (!user) return NextResponse.json({ error }, { status })

    const { searchParams } = request.nextUrl
    const provider = searchParams.get('provider')

    if (!provider) {
      return NextResponse.json(
        { error: 'Parametro provider e obrigatorio' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('ai_settings')
      .delete()
      .eq('provider', provider)

    if (deleteError) {
      console.error('Error deleting AI settings:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao remover configuracao de IA' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/ai/settings:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
