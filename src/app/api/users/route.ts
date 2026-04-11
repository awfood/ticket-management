import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    return NextResponse.json({ error: 'Acesso restrito a usuarios internos' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const tab = searchParams.get('tab') ?? 'internal' // 'internal' or 'all'
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage = parseInt(searchParams.get('per_page') ?? '20', 10)

  if (tab === 'internal') {
    // Internal team: profiles where is_internal = true, with their org_members
    let query = supabase
      .from('profiles')
      .select('*, memberships:org_members(id, org_id, role, is_active, joined_at, organization:organizations(id, name, type))', { count: 'exact' })
      .eq('is_internal', true)

    if (search) {
      query = query.ilike('full_name', `%${search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    const { data: users, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: users ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    })
  }

  // All users: all profiles with memberships
  let query = supabase
    .from('profiles')
    .select('*, memberships:org_members(id, org_id, role, is_active, joined_at, organization:organizations(id, name, type))', { count: 'exact' })

  if (search) {
    query = query.ilike('full_name', `%${search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  const { data: users, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: users ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  })
}
