'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { StatCard } from '@/components/dashboard/stat-card'
import {
  TicketsOverTimeChart,
  ResolutionTimeChart,
} from '@/components/dashboard/charts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { DashboardStats, Organization } from '@/types'
import type { AgentPerformance } from '@/app/api/dashboard/agent-performance/route'

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
]

const CATEGORY_COLORS: Record<string, string> = {
  bug: '#ef4444',
  feature_request: '#3b82f6',
  support: '#22c55e',
  billing: '#f97316',
  integration: '#a855f7',
  configuration: '#eab308',
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature',
  support: 'Suporte',
  billing: 'Cobranca',
  integration: 'Integracao',
  configuration: 'Configuracao',
}

async function fetchStats(
  period: string,
  orgId?: string
): Promise<DashboardStats> {
  const params = new URLSearchParams({ period })
  if (orgId) params.set('org_id', orgId)
  const res = await fetch(`/api/dashboard/stats?${params}`)
  if (!res.ok) throw new Error('Erro ao carregar estatisticas')
  return res.json()
}

async function fetchAgents(period: string): Promise<AgentPerformance[]> {
  const res = await fetch(
    `/api/dashboard/agent-performance?period=${period}`
  )
  if (!res.ok) throw new Error('Erro ao carregar desempenho de agentes')
  return res.json()
}

async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch('/api/organizations')
  if (!res.ok) throw new Error('Erro ao carregar organizacoes')
  const data = await res.json()
  return data.data ?? data ?? []
}

async function fetchCategoryBreakdown(
  period: string,
  orgId?: string
): Promise<{ category: string; count: number }[]> {
  const params = new URLSearchParams({
    sort_by: 'created_at',
    sort_order: 'desc',
    per_page: '100',
  })
  // Filter by date range
  const now = new Date()
  let daysBack = 30
  if (period === '7d') daysBack = 7
  else if (period === '90d') daysBack = 90
  const dateFrom = new Date(
    now.getTime() - daysBack * 24 * 60 * 60 * 1000
  ).toISOString()
  params.set('date_from', dateFrom)
  if (orgId) params.set('org_id', orgId)

  const res = await fetch(`/api/tickets?${params}`)
  if (!res.ok) throw new Error('Erro ao carregar tickets')
  const data = await res.json()
  const tickets = data.data ?? []

  const counts: Record<string, number> = {}
  for (const t of tickets) {
    const cat = (t.category as string) ?? 'support'
    counts[cat] = (counts[cat] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ReportsPage() {
  const user = useUser()
  const [period, setPeriod] = useState('30d')
  const [orgFilter, setOrgFilter] = useState<string>('')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['report-stats', period, orgFilter],
    queryFn: () => fetchStats(period, orgFilter || undefined),
  })

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['report-agents', period],
    queryFn: () => fetchAgents(period),
    enabled: user.isInternal,
  })

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: user.isInternal,
  })

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['report-categories', period, orgFilter],
    queryFn: () =>
      fetchCategoryBreakdown(period, orgFilter || undefined),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Relatorios</h1>
          <p className="text-sm text-muted-foreground">
            Metricas e indicadores de desempenho
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v ?? '30d')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {user.isInternal && organizations && organizations.length > 0 && (
            <Select value={orgFilter} onValueChange={(v) => setOrgFilter(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Todas organizacoes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas organizacoes</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card size="sm" key={i}>
              <CardContent className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Tempo Medio 1a Resposta"
            value={`${stats.avg_first_response_hours}h`}
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="Tempo Medio Resolucao"
            value={`${stats.avg_resolution_hours}h`}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard
            title="Conformidade SLA"
            value={`${stats.sla_compliance_rate}%`}
            icon={AlertTriangle}
            color={stats.sla_compliance_rate >= 90 ? 'green' : 'red'}
          />
        </div>
      ) : null}

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TicketsOverTimeChart data={stats.tickets_over_time} />
          <ResolutionTimeChart data={stats.tickets_over_time} />
        </div>
      )}

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryLoading ? (
            <Skeleton className="h-[250px] w-full rounded-lg" />
          ) : categoryData && categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={categoryData.map((d) => ({
                  name: CATEGORY_LABELS[d.category] ?? d.category,
                  value: d.count,
                  fill:
                    CATEGORY_COLORS[d.category] ?? '#6b7280',
                }))}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value: unknown) => [String(value), 'Tickets']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {categoryData.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={
                        CATEGORY_COLORS[entry.category] ?? '#6b7280'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum dado disponivel para o periodo selecionado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agent Performance Table */}
      {user.isInternal && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Desempenho dos Agentes</CardTitle>
            <Button variant="outline" size="sm" disabled>
              <Download className="size-3.5" data-icon="inline-start" />
              Exportar
            </Button>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : agents && agents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Agente</th>
                      <th className="pb-2 font-medium text-right">
                        Resolvidos
                      </th>
                      <th className="pb-2 font-medium text-right">
                        Tempo Medio
                      </th>
                      <th className="pb-2 font-medium text-right">
                        SLA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr
                        key={agent.agent_id}
                        className="border-b last:border-0"
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              {agent.avatar_url && (
                                <AvatarImage
                                  src={agent.avatar_url}
                                  alt={agent.agent_name}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(agent.agent_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {agent.agent_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {agent.tickets_resolved}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {agent.avg_resolution_hours}h
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={
                              agent.sla_compliance_rate >= 90
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {agent.sla_compliance_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum dado disponivel para o periodo selecionado
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
