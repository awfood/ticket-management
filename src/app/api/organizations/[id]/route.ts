import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*, parent:organizations!parent_org_id(id, name, slug)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !org) {
    return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
  }

  // Check access: internal users can see all; org members can see their own org
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!profile?.is_internal) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  // Fetch related data in parallel
  const [membersResult, childrenResult, ticketsResult] = await Promise.all([
    supabase
      .from('org_members')
      .select('*, profile:profiles(*)')
      .eq('org_id', id)
      .eq('is_active', true)
      .order('joined_at', { ascending: false }),
    supabase
      .from('organizations')
      .select('id, name, slug, type, created_at')
      .eq('parent_org_id', id)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('tickets')
      .select('id, ticket_number, title, status, priority, created_at')
      .eq('org_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    ...org,
    members: membersResult.data ?? [],
    members_count: (membersResult.data ?? []).length,
    children: childrenResult.data ?? [],
    children_count: (childrenResult.data ?? []).length,
    recent_tickets: ticketsResult.data ?? [],
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  const allowedFields = ['name', 'slug', 'type', 'parent_org_id', 'logo_url', 'settings']
  const updates: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  // If slug is being changed, check uniqueness
  if (updates.slug) {
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', updates.slug as string)
      .neq('id', id)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Slug ja esta em uso' }, { status: 409 })
    }
  }

  updates.updated_at = new Date().toISOString()

  const { data: org, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(org)
}
