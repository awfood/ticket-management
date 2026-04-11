'use client'

import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types'

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  open: {
    label: 'Aberto',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  in_progress: {
    label: 'Em andamento',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  waiting_client: {
    label: 'Aguardando cliente',
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  waiting_internal: {
    label: 'Aguardando interno',
    className:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  resolved: {
    label: 'Resolvido',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  closed: {
    label: 'Fechado',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

interface TicketStatusBadgeProps {
  status: TicketStatus
  size?: 'sm' | 'md'
  className?: string
}

export function TicketStatusBadge({
  status,
  size = 'md',
  className,
}: TicketStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}

export function getStatusLabel(status: TicketStatus): string {
  return STATUS_CONFIG[status]?.label ?? status
}

export { STATUS_CONFIG }
