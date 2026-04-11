import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { data: links, error } = await supabase
      .from('ticket_external_links')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching external links:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar links externos' },
        { status: 500 }
      )
    }

    return NextResponse.json(links ?? [])
  } catch (err) {
    console.error(
      'Unexpected error in GET /api/tickets/[id]/external-links:',
      err
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, external_id, external_url, link_type = 'related' } = body

    if (!provider || !external_id || !external_url) {
      return NextResponse.json(
        { error: 'Provedor, ID externo e URL sao obrigatorios' },
        { status: 400 }
      )
    }

    const validProviders = ['jira', 'github']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Provedor invalido. Use: jira ou github' },
        { status: 400 }
      )
    }

    const { data: link, error } = await supabase
      .from('ticket_external_links')
      .insert({
        ticket_id: id,
        provider,
        external_id,
        external_url,
        link_type,
        sync_enabled: false,
        metadata: {},
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating external link:', error)
      return NextResponse.json(
        { error: 'Erro ao criar link externo' },
        { status: 500 }
      )
    }

    // Create history entry
    await supabase.from('ticket_history').insert({
      ticket_id: id,
      changed_by: user.id,
      field_name: 'external_link',
      old_value: null,
      new_value: `${provider}:${external_id}`,
    })

    return NextResponse.json(link, { status: 201 })
  } catch (err) {
    console.error(
      'Unexpected error in POST /api/tickets/[id]/external-links:',
      err
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
