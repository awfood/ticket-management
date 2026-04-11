import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TicketDetail } from '@/components/tickets/ticket-detail'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(
      '*, organization:organizations(id, name, slug, type), creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url), assignee:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !ticket) {
    notFound()
  }

  // Get comments count
  const { count: commentsCount } = await supabase
    .from('ticket_comments')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', id)
    .is('deleted_at', null)

  const ticketWithCount = {
    ...ticket,
    comments_count: commentsCount ?? 0,
  }

  return <TicketDetail ticket={ticketWithCount} />
}
