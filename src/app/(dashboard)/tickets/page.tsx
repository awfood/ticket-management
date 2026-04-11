import { TicketList } from '@/components/tickets/ticket-list'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  // Convert searchParams to simple string record for the client component
  const initialFilters: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      initialFilters[key] = value
    } else if (Array.isArray(value)) {
      initialFilters[key] = value.join(',')
    }
  }

  return <TicketList initialFilters={initialFilters} />
}
