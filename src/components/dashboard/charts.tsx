'use client'

import type { ReactNode } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TicketStatus, TicketPriority } from '@/types'

// --- Color Maps ---
const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#3b82f6',
  in_progress: '#eab308',
  waiting_client: '#f97316',
  waiting_internal: '#a855f7',
  resolved: '#22c55e',
  closed: '#6b7280',
  cancelled: '#ef4444',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Progresso',
  waiting_client: 'Aguard. Cliente',
  waiting_internal: 'Aguard. Interno',
  resolved: 'Resolvido',
  closed: 'Fechado',
  cancelled: 'Cancelado',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: 'Critica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
}

// --- Status Donut Chart ---
interface StatusChartData {
  status: TicketStatus
  count: number
}

export function TicketsByStatusChart({
  data,
}: {
  data: StatusChartData[]
}) {
  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: STATUS_LABELS[d.status],
      value: d.count,
      fill: STATUS_COLORS[d.status],
    }))

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets por Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          Nenhum ticket encontrado
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets por Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown, name: unknown) => [String(value), String(name)]}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-popover)',
                color: 'var(--color-popover-foreground)',
                fontSize: '12px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: unknown) => (
                <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }}>
                  {String(value)}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// --- Priority Bar Chart ---
interface PriorityChartData {
  priority: TicketPriority
  count: number
}

export function TicketsByPriorityChart({
  data,
}: {
  data: PriorityChartData[]
}) {
  const chartData = data.map((d) => ({
    name: PRIORITY_LABELS[d.priority],
    value: d.count,
    fill: PRIORITY_COLORS[d.priority],
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets por Prioridade</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis
              type="category"
              dataKey="name"
              width={70}
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted-foreground)"
            />
            <Tooltip
              formatter={(value: unknown) => [String(value), 'Tickets']}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-popover)',
                color: 'var(--color-popover-foreground)',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// --- Tickets Over Time Line Chart ---
interface OverTimeData {
  date: string
  created: number
  resolved: number
}

export function TicketsOverTimeChart({
  data,
}: {
  data: OverTimeData[]
}) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDateLabel(d.date),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criados vs Resolvidos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={chartData}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              stroke="var(--color-muted-foreground)"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted-foreground)"
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                const n = String(name)
                const label = n === 'created' ? 'Criados' : 'Resolvidos'
                return [String(value), label]
              }}
              labelFormatter={(label: unknown) => `Data: ${String(label)}`}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-popover)',
                color: 'var(--color-popover-foreground)',
                fontSize: '12px',
              }}
            />
            <Legend
              formatter={(value: unknown): ReactNode => {
                const v = String(value)
                const labels: Record<string, string> = {
                  created: 'Criados',
                  resolved: 'Resolvidos',
                }
                return (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }}>
                    {labels[v] ?? v}
                  </span>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="created"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// --- Resolution Time Area Chart ---
export function ResolutionTimeChart({
  data,
}: {
  data: OverTimeData[]
}) {
  // Compute a rolling average of resolutions per day as a proxy for resolution time
  const chartData = data.map((d) => ({
    dateLabel: formatDateLabel(d.date),
    resolved: d.resolved,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets Resolvidos por Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={chartData}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              stroke="var(--color-muted-foreground)"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted-foreground)"
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value: unknown) => [String(value), 'Resolvidos']}
              labelFormatter={(label: unknown) => `Data: ${String(label)}`}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-popover)',
                color: 'var(--color-popover-foreground)',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="resolved"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function formatDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}
