import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AgentPerformance {
  agent_id: string
  agent_name: string
  avatar_url: string | null
  tickets_resolved: number
  avg_resolution_hours: number
  sla_compliance_rate: number
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    // Check if user is internal
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_internal')
      .eq('id', user.id)
      .single()

    if (!profile?.is_internal) {
      return NextResponse.json(
        { error: 'Acesso restrito a usuarios internos' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') ?? '30d'

    let daysBack = 30
    if (period === '7d') daysBack = 7
    else if (period === '90d') daysBack = 90
    const dateFrom = new Date(
      Date.now() - daysBack * 24 * 60 * 60 * 1000
    ).toISOString()

    // Get all resolved/closed tickets in the period with assignee
    const { data: resolvedTickets } = await supabase
      .from('tickets')
      .select('assigned_to, created_at, resolved_at, sla_breach')
      .is('deleted_at', null)
      .not('assigned_to', 'is', null)
      .in('status', ['resolved', 'closed'])
      .gte('resolved_at', dateFrom)

    if (!resolvedTickets || resolvedTickets.length === 0) {
      return NextResponse.json([])
    }

    // Aggregate per agent
    const agentMap = new Map<
      string,
      {
        count: number
        totalHours: number
        slaCompliant: number
      }
    >()

    for (const t of resolvedTickets) {
      const agentId = t.assigned_to as string
      const existing = agentMap.get(agentId) ?? {
        count: 0,
        totalHours: 0,
        slaCompliant: 0,
      }

      existing.count++
      if (t.resolved_at && t.created_at) {
        const hours =
          (new Date(t.resolved_at).getTime() -
            new Date(t.created_at).getTime()) /
          (1000 * 60 * 60)
        existing.totalHours += hours
      }
      if (!t.sla_breach) {
        existing.slaCompliant++
      }

      agentMap.set(agentId, existing)
    }

    // Fetch agent profiles
    const agentIds = Array.from(agentMap.keys())
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', agentIds)

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    )

    const result: AgentPerformance[] = agentIds
      .map((agentId) => {
        const stats = agentMap.get(agentId)!
        const p = profileMap.get(agentId)
        return {
          agent_id: agentId,
          agent_name: p?.full_name ?? 'Desconhecido',
          avatar_url: p?.avatar_url ?? null,
          tickets_resolved: stats.count,
          avg_resolution_hours:
            stats.count > 0
              ? Math.round((stats.totalHours / stats.count) * 10) / 10
              : 0,
          sla_compliance_rate:
            stats.count > 0
              ? Math.round((stats.slaCompliant / stats.count) * 1000) / 10
              : 100,
        }
      })
      .sort((a, b) => b.tickets_resolved - a.tickets_resolved)

    return NextResponse.json(result)
  } catch (err) {
    console.error(
      'Unexpected error in GET /api/dashboard/agent-performance:',
      err
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
