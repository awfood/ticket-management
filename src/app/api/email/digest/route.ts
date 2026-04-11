import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendDailyDigest } from '@/lib/email/send'
import type { DailyDigestParams, DigestTicketRow } from '@/lib/email/templates'

// POST { period: 'morning' | 'afternoon' }
// Called by cron job or manually
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-secret')
  if (authHeader !== process.env.INTERNAL_API_SECRET && process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { period } = await request.json()
  if (!period || !['morning', 'afternoon'].includes(period)) {
    return NextResponse.json({ error: 'period deve ser morning ou afternoon' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const today = new Date().toISOString().slice(0, 10)

  // Fetch all internal users with their emails
  const { data: internalProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, is_internal')
    .eq('is_internal', true)

  if (!internalProfiles || internalProfiles.length === 0) {
    return NextResponse.json({ data: { sent: 0, message: 'Nenhum usuario interno' } })
  }

  // Get emails from auth
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const emailMap = new Map<string, string>()
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email)
  }

  // Get roles for each user
  const { data: memberships } = await supabase
    .from('org_members')
    .select('user_id, role')
    .in('user_id', internalProfiles.map((p) => p.id))
    .eq('is_active', true)

  const roleMap = new Map<string, string>()
  for (const m of memberships ?? []) {
    const current = roleMap.get(m.user_id)
    // Keep the highest role
    if (!current || m.role === 'super_admin' || (m.role === 'admin' && current !== 'super_admin')) {
      roleMap.set(m.user_id, m.role)
    }
  }

  // Global stats
  const { data: openTickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, status, priority, org_id, assigned_to, due_date, created_at')
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress', 'waiting_client', 'waiting_internal'])

  const allOpen = openTickets ?? []

  const totalOpen = allOpen.filter((t) => t.status === 'open').length
  const totalInProgress = allOpen.filter((t) => t.status === 'in_progress').length
  const totalWaitingClient = allOpen.filter((t) => t.status === 'waiting_client').length
  const totalWaitingInternal = allOpen.filter((t) => t.status === 'waiting_internal').length
  const slaBreachCount = allOpen.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length
  const unassignedCount = allOpen.filter((t) => !t.assigned_to).length

  // Get org names for ticket display
  const orgIds = [...new Set(allOpen.map((t) => t.org_id))]
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name')
    .in('id', orgIds)

  const orgNameMap = new Map<string, string>()
  for (const o of orgs ?? []) {
    orgNameMap.set(o.id, o.name)
  }

  function toRow(t: typeof allOpen[0]): DigestTicketRow {
    return {
      ticket_number: t.ticket_number,
      title: t.title,
      status: t.status,
      priority: t.priority,
      org_name: orgNameMap.get(t.org_id),
      url: `${appUrl}/tickets/${t.id}`,
    }
  }

  // Afternoon-specific: tickets opened/closed today
  let ticketsOpenedToday = 0
  let ticketsClosedToday = 0
  if (period === 'afternoon') {
    const { count: openedCount } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', `${today}T00:00:00`)

    const { count: closedCount } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', ['resolved', 'closed'])
      .gte('resolved_at', `${today}T00:00:00`)

    ticketsOpenedToday = openedCount ?? 0
    ticketsClosedToday = closedCount ?? 0
  }

  // Due today (morning)
  const ticketsDueToday = allOpen
    .filter((t) => t.due_date && t.due_date.startsWith(today))
    .map(toRow)

  // Urgent tickets (critical + high)
  const urgentAll = allOpen
    .filter((t) => t.priority === 'critical' || t.priority === 'high')
    .map(toRow)

  let sent = 0
  let failed = 0

  for (const profile of internalProfiles) {
    const email = emailMap.get(profile.id)
    if (!email) continue

    const role = roleMap.get(profile.id)
    const isAdmin = role === 'super_admin' || role === 'admin'

    // For non-admin: show only their assigned tickets
    const assignedTickets = allOpen
      .filter((t) => t.assigned_to === profile.id)
      .map(toRow)

    // For non-admin: show only urgent tickets assigned to them
    const urgent = isAdmin
      ? urgentAll
      : urgentAll.filter((t) => {
          const orig = allOpen.find((o) => o.ticket_number === t.ticket_number)
          return orig?.assigned_to === profile.id
        })

    const params: DailyDigestParams = {
      recipientName: profile.full_name,
      period: period as 'morning' | 'afternoon',
      totalOpen: isAdmin ? totalOpen : assignedTickets.filter((t) => t.status === 'open').length,
      totalInProgress: isAdmin ? totalInProgress : assignedTickets.filter((t) => t.status === 'in_progress').length,
      totalWaitingClient: isAdmin ? totalWaitingClient : assignedTickets.filter((t) => t.status === 'waiting_client').length,
      totalWaitingInternal: isAdmin ? totalWaitingInternal : assignedTickets.filter((t) => t.status === 'waiting_internal').length,
      ticketsDueToday: period === 'morning' ? (isAdmin ? ticketsDueToday : ticketsDueToday.filter((t) => {
        const orig = allOpen.find((o) => o.ticket_number === t.ticket_number)
        return orig?.assigned_to === profile.id
      })) : undefined,
      ticketsOpenedToday: period === 'afternoon' ? ticketsOpenedToday : undefined,
      ticketsClosedToday: period === 'afternoon' ? ticketsClosedToday : undefined,
      assignedTickets,
      urgentTickets: urgent,
      isAdmin,
      totalAllOpen: isAdmin ? allOpen.length : undefined,
      slaBreachCount: isAdmin ? slaBreachCount : undefined,
      unassignedCount: isAdmin ? unassignedCount : undefined,
    }

    const result = await sendDailyDigest(email, params)
    if (result.success) sent++
    else failed++
  }

  return NextResponse.json({ data: { sent, failed, period } })
}
