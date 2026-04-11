import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DashboardStats, TicketStatus, TicketPriority } from '@/types'

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
    const orgId = searchParams.get('org_id')
    const period = searchParams.get('period') ?? '30d'

    // Calculate date range
    const now = new Date()
    let daysBack = 30
    if (period === '7d') daysBack = 7
    else if (period === '90d') daysBack = 90
    const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const dateFromIso = dateFrom.toISOString()

    // Today boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    // --- Count by status ---
    let statusQuery = supabase
      .from('tickets')
      .select('status', { count: 'exact', head: false })
      .is('deleted_at', null)
    if (orgId) statusQuery = statusQuery.eq('org_id', orgId)

    const { data: allTickets } = await statusQuery

    const statusCounts: Record<string, number> = {}
    for (const row of allTickets ?? []) {
      const s = row.status as string
      statusCounts[s] = (statusCounts[s] ?? 0) + 1
    }

    const totalOpen = statusCounts['open'] ?? 0
    const totalInProgress = statusCounts['in_progress'] ?? 0

    // --- Tickets resolved today ---
    let resolvedTodayQuery = supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', ['resolved', 'closed'])
      .gte('resolved_at', todayStart)
      .lt('resolved_at', todayEnd)
    if (orgId) resolvedTodayQuery = resolvedTodayQuery.eq('org_id', orgId)

    const { count: resolvedTodayCount } = await resolvedTodayQuery

    // --- SLA breach count ---
    let slaBreachQuery = supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('sla_breach', true)
      .in('status', ['open', 'in_progress', 'waiting_client', 'waiting_internal'])
    if (orgId) slaBreachQuery = slaBreachQuery.eq('org_id', orgId)

    const { count: slaBreachCount } = await slaBreachQuery

    // --- Average first response time (hours) ---
    let responseTimeQuery = supabase
      .from('tickets')
      .select('created_at, first_response_at')
      .is('deleted_at', null)
      .not('first_response_at', 'is', null)
      .gte('created_at', dateFromIso)
    if (orgId) responseTimeQuery = responseTimeQuery.eq('org_id', orgId)

    const { data: responseTimeData } = await responseTimeQuery

    let avgFirstResponseHours = 0
    if (responseTimeData && responseTimeData.length > 0) {
      const totalHours = responseTimeData.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime()
        const responded = new Date(t.first_response_at!).getTime()
        return sum + (responded - created) / (1000 * 60 * 60)
      }, 0)
      avgFirstResponseHours = Math.round((totalHours / responseTimeData.length) * 10) / 10
    }

    // --- Average resolution time (hours) ---
    let resolutionTimeQuery = supabase
      .from('tickets')
      .select('created_at, resolved_at')
      .is('deleted_at', null)
      .not('resolved_at', 'is', null)
      .gte('created_at', dateFromIso)
    if (orgId) resolutionTimeQuery = resolutionTimeQuery.eq('org_id', orgId)

    const { data: resolutionTimeData } = await resolutionTimeQuery

    let avgResolutionHours = 0
    if (resolutionTimeData && resolutionTimeData.length > 0) {
      const totalHours = resolutionTimeData.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime()
        const resolved = new Date(t.resolved_at!).getTime()
        return sum + (resolved - created) / (1000 * 60 * 60)
      }, 0)
      avgResolutionHours = Math.round((totalHours / resolutionTimeData.length) * 10) / 10
    }

    // --- SLA compliance rate ---
    let slaComplianceQuery = supabase
      .from('tickets')
      .select('sla_breach')
      .is('deleted_at', null)
      .in('status', ['resolved', 'closed'])
      .gte('created_at', dateFromIso)
    if (orgId) slaComplianceQuery = slaComplianceQuery.eq('org_id', orgId)

    const { data: slaData } = await slaComplianceQuery

    let slaComplianceRate = 100
    if (slaData && slaData.length > 0) {
      const compliant = slaData.filter((t) => !t.sla_breach).length
      slaComplianceRate = Math.round((compliant / slaData.length) * 1000) / 10
    }

    // --- Tickets by status ---
    const allStatuses: TicketStatus[] = [
      'open',
      'in_progress',
      'waiting_client',
      'waiting_internal',
      'resolved',
      'closed',
      'cancelled',
    ]
    const ticketsByStatus = allStatuses.map((status) => ({
      status,
      count: statusCounts[status] ?? 0,
    }))

    // --- Tickets by priority ---
    let priorityQuery = supabase
      .from('tickets')
      .select('priority')
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress', 'waiting_client', 'waiting_internal'])
    if (orgId) priorityQuery = priorityQuery.eq('org_id', orgId)

    const { data: priorityData } = await priorityQuery

    const priorityCounts: Record<string, number> = {}
    for (const row of priorityData ?? []) {
      const p = row.priority as string
      priorityCounts[p] = (priorityCounts[p] ?? 0) + 1
    }

    const allPriorities: TicketPriority[] = ['critical', 'high', 'medium', 'low']
    const ticketsByPriority = allPriorities.map((priority) => ({
      priority,
      count: priorityCounts[priority] ?? 0,
    }))

    // --- Tickets over time (daily created vs resolved) ---
    let timeSeriesCreatedQuery = supabase
      .from('tickets')
      .select('created_at')
      .is('deleted_at', null)
      .gte('created_at', dateFromIso)
    if (orgId) timeSeriesCreatedQuery = timeSeriesCreatedQuery.eq('org_id', orgId)

    const { data: timeCreated } = await timeSeriesCreatedQuery

    let timeSeriesResolvedQuery = supabase
      .from('tickets')
      .select('resolved_at')
      .is('deleted_at', null)
      .not('resolved_at', 'is', null)
      .gte('resolved_at', dateFromIso)
    if (orgId) timeSeriesResolvedQuery = timeSeriesResolvedQuery.eq('org_id', orgId)

    const { data: timeResolved } = await timeSeriesResolvedQuery

    // Build daily map
    const dailyMap: Record<string, { created: number; resolved: number }> = {}
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(now.getTime() - (daysBack - 1 - i) * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dailyMap[key] = { created: 0, resolved: 0 }
    }

    for (const row of timeCreated ?? []) {
      const key = new Date(row.created_at).toISOString().slice(0, 10)
      if (dailyMap[key]) dailyMap[key].created++
    }

    for (const row of timeResolved ?? []) {
      const key = new Date(row.resolved_at!).toISOString().slice(0, 10)
      if (dailyMap[key]) dailyMap[key].resolved++
    }

    const ticketsOverTime = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))

    const stats: DashboardStats = {
      total_open: totalOpen,
      total_in_progress: totalInProgress,
      total_resolved_today: resolvedTodayCount ?? 0,
      total_sla_breach: slaBreachCount ?? 0,
      avg_first_response_hours: avgFirstResponseHours,
      avg_resolution_hours: avgResolutionHours,
      sla_compliance_rate: slaComplianceRate,
      tickets_by_status: ticketsByStatus,
      tickets_by_priority: ticketsByPriority,
      tickets_over_time: ticketsOverTime,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('Unexpected error in GET /api/dashboard/stats:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
