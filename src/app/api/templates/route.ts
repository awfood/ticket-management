import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const category = searchParams.get('category')
  const activeOnly = searchParams.get('active') !== 'false'

  let query = supabase
    .from('ticket_templates')
    .select('*')
    .order('sort_order', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)
  if (category) query = query.eq('category', category)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
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
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, description, category, icon,
    title_template, body_template,
    default_priority, default_category, default_service,
    default_assigned_to, default_tags, fields, sort_order,
  } = body

  if (!name || !title_template || !body_template) {
    return NextResponse.json(
      { error: 'Campos name, title_template e body_template obrigatorios' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('ticket_templates')
    .insert({
      name,
      description: description || null,
      category: category || null,
      icon: icon || 'FileText',
      title_template,
      body_template,
      default_priority: default_priority || 'medium',
      default_category: default_category || null,
      default_service: default_service || null,
      default_assigned_to: default_assigned_to || null,
      default_tags: default_tags || [],
      fields: fields || [],
      sort_order: sort_order ?? 0,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
