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
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  const parentId = searchParams.get('parent_id')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const perPage = parseInt(searchParams.get('per_page') ?? '20', 10)

  let query = supabase
    .from('organizations')
    .select('*, parent:organizations!parent_org_id(id, name, slug)', { count: 'exact' })
    .is('deleted_at', null)
    .neq('type', 'internal')

  if (type) {
    query = query.eq('type', type)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
  }

  if (parentId) {
    // Fetch only children of the specified parent org
    query = query.eq('parent_org_id', parentId)
  } else {
    // Top-level only: no parent
    query = query.is('parent_org_id', null)
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  const { data: organizations, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch member counts and ticket counts for each org
  const orgIds = (organizations ?? []).map((o) => o.id)

  const [membersResult, ticketsResult, childrenResult] = await Promise.all([
    supabase
      .from('org_members')
      .select('org_id', { count: 'exact', head: false })
      .in('org_id', orgIds)
      .eq('is_active', true),
    supabase
      .from('tickets')
      .select('org_id', { count: 'exact', head: false })
      .in('org_id', orgIds)
      .is('deleted_at', null),
    supabase
      .from('organizations')
      .select('parent_org_id')
      .in('parent_org_id', orgIds)
      .is('deleted_at', null),
  ])

  // Build count maps
  const memberCounts: Record<string, number> = {}
  const ticketCounts: Record<string, number> = {}
  const childrenCounts: Record<string, number> = {}

  for (const m of membersResult.data ?? []) {
    memberCounts[m.org_id] = (memberCounts[m.org_id] ?? 0) + 1
  }
  for (const t of ticketsResult.data ?? []) {
    ticketCounts[t.org_id] = (ticketCounts[t.org_id] ?? 0) + 1
  }
  for (const c of childrenResult.data ?? []) {
    if (c.parent_org_id) {
      childrenCounts[c.parent_org_id] = (childrenCounts[c.parent_org_id] ?? 0) + 1
    }
  }

  const enriched = (organizations ?? []).map((org) => ({
    ...org,
    members_count: memberCounts[org.id] ?? 0,
    tickets_count: ticketCounts[org.id] ?? 0,
    children_count: childrenCounts[org.id] ?? 0,
  }))

  return NextResponse.json({
    data: enriched,
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  })
}

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
    return NextResponse.json({ error: 'Acesso restrito a usuarios internos' }, { status: 403 })
  }

  const body = await request.json()
  const { name, slug, type, parent_org_id, logo_url } = body

  if (!name || !slug || !type) {
    return NextResponse.json(
      { error: 'Campos obrigatorios: name, slug, type' },
      { status: 400 }
    )
  }

  if (!['client', 'whitelabel'].includes(type)) {
    return NextResponse.json(
      { error: 'Tipo deve ser client ou whitelabel' },
      { status: 400 }
    )
  }

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Slug ja esta em uso' },
      { status: 409 }
    )
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      type,
      parent_org_id: parent_org_id || null,
      logo_url: logo_url || null,
      settings: {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(org, { status: 201 })
}
