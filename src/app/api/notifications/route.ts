import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage = parseInt(searchParams.get('per_page') ?? '20', 10)
  const unreadOnly = searchParams.get('unread_only') === 'true'

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  query = query
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  const { data: notifications, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: notifications ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { ids } = body

  const now = new Date().toISOString()

  if (ids === 'all') {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Todas notificacoes marcadas como lidas' })
  }

  if (Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: `${ids.length} notificacoes marcadas como lidas` })
  }

  return NextResponse.json({ error: 'Informe ids (array) ou "all"' }, { status: 400 })
}
