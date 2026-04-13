'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Inbox,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { StatCard } from '@/components/dashboard/stat-card'
import {
  TicketsByStatusChart,
  TicketsByPriorityChart,
  TicketsOverTimeChart,
  ResolutionTimeChart,
} from '@/components/dashboard/charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { DashboardStats, Ticket } from '@/types'

async function fetchStats(period: string): Promise<DashboardStats> {
  const res = await fetch(`/api/dashboard/stats?period=${period}`)
  if (!res.ok) {
    throw new Error('Erro ao carregar estatisticas')
  }
  return res.json()
}

async function fetchUnassigned(): Promise<Ticket[]> {
  const res = await fetch(
    '/api/tickets?status=open&sort_by=created_at&sort_order=desc&per_page=5'
  )
  if (!res.ok) {
    throw new Error('Erro ao carregar tickets')
  }
  const data = await res.json()
  return (data.data ?? []).filter(
    (t: Ticket) => !t.assigned_to
  )
}

async function fetchSlaAlerts(): Promise<Ticket[]> {
  const res = await fetch(
    '/api/tickets?status=open,in_progress,waiting_client,waiting_internal&sort_by=created_at&sort_order=asc&per_page=10'
  )
  if (!res.ok) {
    throw new Error('Erro ao carregar alertas SLA')
  }
  const data = await res.json()
  return (data.data ?? []).filter((t: Ticket) => t.sla_breach)
}

export function DashboardHome() {
  const user = useUser()

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard-stats', '30d'],
    queryFn: () => fetchStats('30d'),
  })

  const { data: unassigned, isLoading: unassignedLoading } = useQuery({
    queryKey: ['unassigned-tickets'],
    queryFn: fetchUnassigned,
    enabled: user.isInternal,
  })

  const { data: slaAlerts, isLoading: slaLoading } = useQuery({
    queryKey: ['sla-alerts'],
    queryFn: fetchSlaAlerts,
    enabled: user.isInternal,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral dos últimos 30 dias
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStats()}
          disabled={statsLoading}
        >
          <RefreshCw
            className={`size-3.5 ${statsLoading ? 'animate-spin' : ''}`}
            data-icon="inline-start"
          />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card size="sm" key={i}>
              <CardContent className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            { title: 'Abertos', value: stats.total_open, icon: Inbox, color: 'blue' },
            { title: 'Em Progresso', value: stats.total_in_progress, icon: Clock, color: 'yellow' },
            { title: 'Resolvidos Hoje', value: stats.total_resolved_today, icon: CheckCircle2, color: 'green' },
            { title: 'Prazo Excedido', value: stats.total_sla_breach, icon: AlertTriangle, color: 'red' },
          ] as const).map((card, i) => (
            <div
              key={card.title}
              className="animate-slide-up-fade"
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <StatCard {...card} />
            </div>
          ))}
        </div>
      ) : null}

      {/* Charts Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[250px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TicketsByStatusChart data={stats.tickets_by_status} />
          <TicketsByPriorityChart data={stats.tickets_by_priority} />
          <TicketsOverTimeChart data={stats.tickets_over_time} />
          <ResolutionTimeChart data={stats.tickets_over_time} />
        </div>
      ) : null}

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            { title: 'Tempo Médio 1ª Resposta', value: `${stats.avg_first_response_hours}h`, icon: Clock, color: 'purple' },
            { title: 'Tempo Médio de Resolução', value: `${stats.avg_resolution_hours}h`, icon: CheckCircle2, color: 'gray' },
            {
              title: 'Conformidade de Prazo',
              value: `${stats.sla_compliance_rate}%`,
              icon: AlertTriangle,
              color: stats.sla_compliance_rate >= 90 ? ('green' as const) : ('red' as const),
            },
          ] as const).map((card, i) => (
            <div
              key={card.title}
              className="animate-slide-up-fade"
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <StatCard {...card} />
            </div>
          ))}
        </div>
      )}

      {/* Bottom section: Unassigned + SLA Alerts */}
      {user.isInternal && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Unassigned Tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Tickets Não Atribuídos</CardTitle>
            </CardHeader>
            <CardContent>
              {unassignedLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !unassigned || unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Todos os tickets abertos estão atribuídos.
                </p>
              ) : (
                <div className="space-y-2">
                  {unassigned.map((ticket) => (
                    <a
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center justify-between rounded-md border p-2.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          {ticket.ticket_number}
                        </span>
                        <span className="truncate">{ticket.title}</span>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {ticket.priority}
                      </Badge>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-500" />
                Alertas SLA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slaLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !slaAlerts || slaAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center animate-slide-up-fade">
                  <CheckCircle2 className="size-8 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Tudo em dia.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nenhum ticket com prazo excedido.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slaAlerts.slice(0, 5).map((ticket) => (
                    <a
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 p-2.5 text-sm hover:bg-red-100/50 transition-colors dark:border-red-900/30 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs text-red-600 dark:text-red-400 mr-2">
                          {ticket.ticket_number}
                        </span>
                        <span className="truncate">{ticket.title}</span>
                      </div>
                      <AlertCircle className="size-3.5 text-red-500 ml-2 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
