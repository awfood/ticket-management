import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TicketFilters, PaginatedResponse, Ticket } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams

    // Parse filters
    const filters: TicketFilters = {}
    const statusParam = searchParams.get('status')
    if (statusParam) {
      filters.status = statusParam.split(',') as TicketFilters['status']
    }
    const priorityParam = searchParams.get('priority')
    if (priorityParam) {
      filters.priority = priorityParam.split(',') as TicketFilters['priority']
    }
    const categoryParam = searchParams.get('category')
    if (categoryParam) {
      filters.category = categoryParam.split(',') as TicketFilters['category']
    }
    if (searchParams.get('assigned_to')) {
      filters.assigned_to = searchParams.get('assigned_to')!
    }
    if (searchParams.get('org_id')) {
      filters.org_id = searchParams.get('org_id')!
    }
    if (searchParams.get('search')) {
      filters.search = searchParams.get('search')!
    }
    if (searchParams.get('date_from')) {
      filters.date_from = searchParams.get('date_from')!
    }
    if (searchParams.get('date_to')) {
      filters.date_to = searchParams.get('date_to')!
    }
    const tagsParam = searchParams.get('tags')
    if (tagsParam) {
      filters.tags = tagsParam.split(',')
    }
    if (searchParams.get('affected_service')) {
      filters.affected_service =
        searchParams.get('affected_service') as TicketFilters['affected_service']
    }

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10))
    )
    const offset = (page - 1) * perPage

    // Sorting
    const sortBy = searchParams.get('sort_by') ?? 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc' ? true : false

    // Build query
    let query = supabase
      .from('tickets')
      .select(
        '*, organization:organizations(id, name, slug), creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url), assignee:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)',
        { count: 'exact' }
      )
      .is('deleted_at', null)

    // Apply filters
    if (filters.status?.length) {
      query = query.in('status', filters.status)
    }
    if (filters.priority?.length) {
      query = query.in('priority', filters.priority)
    }
    if (filters.category?.length) {
      query = query.in('category', filters.category)
    }
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to)
    }
    if (filters.org_id) {
      query = query.eq('org_id', filters.org_id)
    }
    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from)
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to)
    }
    if (filters.tags?.length) {
      query = query.overlaps('tags', filters.tags)
    }
    if (filters.affected_service) {
      query = query.eq('affected_service', filters.affected_service)
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder })
      .range(offset, offset + perPage - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching tickets:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar tickets' },
        { status: 500 }
      )
    }

    const total = count ?? 0
    const response: PaginatedResponse<Ticket> = {
      data: data ?? [],
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Unexpected error in GET /api/tickets:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const {
      title,
      description,
      priority = 'medium',
      category,
      org_id,
      affected_service,
      environment,
      impact,
      steps_to_reproduce,
      expected_behavior,
      actual_behavior,
      tags,
    } = body

    if (!title || !description || !org_id) {
      return NextResponse.json(
        { error: 'Titulo, descricao e organizacao sao obrigatorios' },
        { status: 400 }
      )
    }

    // Generate ticket number
    const { data: lastTicket } = await supabase
      .from('tickets')
      .select('ticket_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let nextNumber = 1
    if (lastTicket?.ticket_number) {
      const match = lastTicket.ticket_number.match(/TK-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    const ticketNumber = `TK-${String(nextNumber).padStart(5, '0')}`

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        title,
        description,
        description_html: body.description_html || null,
        priority,
        category: category || null,
        org_id,
        affected_service: affected_service || null,
        environment: environment || null,
        impact: impact || null,
        steps_to_reproduce: steps_to_reproduce || null,
        expected_behavior: expected_behavior || null,
        actual_behavior: actual_behavior || null,
        tags: tags || [],
        status: 'open',
        created_by: user.id,
        metadata: {},
      })
      .select(
        '*, organization:organizations(id, name, slug), creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url)'
      )
      .single()

    if (error) {
      console.error('Error creating ticket:', error)
      return NextResponse.json(
        { error: 'Erro ao criar ticket' },
        { status: 500 }
      )
    }

    // Create history entry
    await supabase.from('ticket_history').insert({
      ticket_id: ticket.id,
      changed_by: user.id,
      field_name: 'status',
      old_value: null,
      new_value: 'open',
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (err) {
    console.error('Unexpected error in POST /api/tickets:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
