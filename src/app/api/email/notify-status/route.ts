import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTicketStatusChanged } from '@/lib/email/send'

// Called internally when a ticket status changes
// POST { ticket_id, old_status, new_status, changed_by_id }
export async function POST(request: NextRequest) {
  // Only accept internal calls (check for internal secret or session)
  const authHeader = request.headers.get('x-internal-secret')
  if (authHeader !== process.env.INTERNAL_API_SECRET && process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ticket_id, old_status, new_status, changed_by_id } = await request.json()

  if (!ticket_id || !old_status || !new_status) {
    return NextResponse.json({ error: 'Campos obrigatorios: ticket_id, old_status, new_status' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Fetch ticket with related data
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, org_id, created_by, assigned_to')
    .eq('id', ticket_id)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket nao encontrado' }, { status: 404 })
  }

  // Get changer name
  const { data: changer } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', changed_by_id)
    .single()

  const changerName = changer?.full_name ?? 'Sistema'

  // Collect all users to notify
  const userIdsToNotify = new Set<string>()

  // Creator
  if (ticket.created_by && ticket.created_by !== changed_by_id) {
    userIdsToNotify.add(ticket.created_by)
  }

  // Assignee
  if (ticket.assigned_to && ticket.assigned_to !== changed_by_id) {
    userIdsToNotify.add(ticket.assigned_to)
  }

  // Watchers
  const { data: watchers } = await supabase
    .from('ticket_watchers')
    .select('user_id')
    .eq('ticket_id', ticket_id)

  for (const w of watchers ?? []) {
    if (w.user_id !== changed_by_id) {
      userIdsToNotify.add(w.user_id)
    }
  }

  if (userIdsToNotify.size === 0) {
    return NextResponse.json({ data: { sent: 0, message: 'Nenhum destinatario' } })
  }

  // Fetch emails for all users
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', Array.from(userIdsToNotify))

  // Get emails from auth.users
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const emailMap = new Map<string, string>()
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email)
  }

  let sent = 0
  let failed = 0

  for (const user of users ?? []) {
    const email = emailMap.get(user.id)
    if (!email) continue

    const result = await sendTicketStatusChanged(email, {
      recipientName: user.full_name,
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      oldStatus: old_status,
      newStatus: new_status,
      changedBy: changerName,
      ticketUrl: `${appUrl}/tickets/${ticket.id}`,
    })

    if (result.success) sent++
    else failed++
  }

  return NextResponse.json({ data: { sent, failed } })
}
