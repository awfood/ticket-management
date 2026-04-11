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

    const { data: history, error } = await supabase
      .from('ticket_history')
      .select(
        '*, changer:profiles!ticket_history_changed_by_fkey(id, full_name, avatar_url)'
      )
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching history:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar historico' },
        { status: 500 }
      )
    }

    return NextResponse.json(history ?? [])
  } catch (err) {
    console.error(
      'Unexpected error in GET /api/tickets/[id]/history:',
      err
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
