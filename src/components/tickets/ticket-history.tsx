'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowRight,
  User,
  Tag,
  AlertCircle,
  Clock,
  Settings,
  Link2,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getStatusLabel } from './ticket-status-badge'
import { getPriorityLabel } from './ticket-priority-badge'
import type { TicketHistory as TicketHistoryType, TicketStatus, TicketPriority } from '@/types'

interface TicketHistoryProps {
  ticketId: string
}

const FIELD_CONFIG: Record<
  string,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    formatValue?: (val: string | null) => string
  }
> = {
  status: {
    label: 'status',
    icon: Clock,
    formatValue: (val) =>
      val ? getStatusLabel(val as TicketStatus) : 'Nenhum',
  },
  priority: {
    label: 'prioridade',
    icon: AlertCircle,
    formatValue: (val) =>
      val ? getPriorityLabel(val as TicketPriority) : 'Nenhuma',
  },
  assigned_to: {
    label: 'responsavel',
    icon: User,
    formatValue: (val) => val ?? 'Ninguem',
  },
  category: {
    label: 'categoria',
    icon: Tag,
    formatValue: (val) => val ?? 'Nenhuma',
  },
  title: { label: 'titulo', icon: Settings },
  description: { label: 'descricao', icon: Settings },
  affected_service: {
    label: 'servico afetado',
    icon: Settings,
    formatValue: (val) => val ?? 'Nenhum',
  },
  tags: { label: 'tags', icon: Tag },
  external_link: {
    label: 'link externo',
    icon: Link2,
    formatValue: (val) => val ?? '',
  },
  impact: {
    label: 'impacto',
    icon: AlertCircle,
    formatValue: (val) => val ?? 'Nenhum',
  },
  environment: {
    label: 'ambiente',
    icon: Settings,
    formatValue: (val) => val ?? 'Nenhum',
  },
  due_date: {
    label: 'data limite',
    icon: Clock,
    formatValue: (val) => val ?? 'Nenhuma',
  },
}

export function TicketHistory({ ticketId }: TicketHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['ticket-history', ticketId],
    queryFn: async (): Promise<TicketHistoryType[]> => {
      const res = await fetch(`/api/tickets/${ticketId}/history`)
      if (!res.ok) throw new Error('Erro ao carregar historico')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Historico</h3>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Historico</h3>
        <p className="text-sm text-muted-foreground">
          Nenhuma alteracao registrada.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Historico</h3>
      <div className="relative space-y-0">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

        {history.map((entry) => {
          const config = FIELD_CONFIG[entry.field_name] ?? {
            label: entry.field_name,
            icon: Settings,
          }
          const Icon = config.icon
          const formatValue = config.formatValue ?? ((v: string | null) => v ?? 'Nenhum')

          const changerName = entry.changer?.full_name ?? 'Sistema'
          const isCreation = entry.old_value === null && entry.field_name === 'status'

          return (
            <div key={entry.id} className="relative flex gap-3 pb-4">
              <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background">
                <Icon className="size-3 text-muted-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-xs text-foreground">
                  <span className="font-medium">{changerName}</span>
                  {isCreation ? (
                    <span> criou o ticket</span>
                  ) : (
                    <>
                      <span> alterou </span>
                      <span className="font-medium">{config.label}</span>
                      {entry.old_value != null && (
                        <>
                          <span> de </span>
                          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                            {formatValue(entry.old_value)}
                          </span>
                        </>
                      )}
                      <span> para </span>
                      <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                        {formatValue(entry.new_value)}
                      </span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {format(
                    new Date(entry.created_at),
                    "dd/MM/yy 'as' HH:mm",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
