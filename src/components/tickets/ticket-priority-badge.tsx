'use client'

import { AlertTriangle, ArrowUp, Minus, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TicketPriority } from '@/types'

const PRIORITY_CONFIG: Record<
  TicketPriority,
  {
    label: string
    className: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  critical: {
    label: 'Critica',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertTriangle,
  },
  high: {
    label: 'Alta',
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: ArrowUp,
  },
  medium: {
    label: 'Media',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Minus,
  },
  low: {
    label: 'Baixa',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: ArrowDown,
  },
}

interface TicketPriorityBadgeProps {
  priority: TicketPriority
  size?: 'sm' | 'md'
  className?: string
}

export function TicketPriorityBadge({
  priority,
  size = 'md',
  className,
}: TicketPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority]
  if (!config) return null

  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        config.className,
        className
      )}
    >
      <Icon
        className={cn(size === 'sm' ? 'size-2.5' : 'size-3')}
      />
      {config.label}
    </span>
  )
}

export function getPriorityLabel(priority: TicketPriority): string {
  return PRIORITY_CONFIG[priority]?.label ?? priority
}

export { PRIORITY_CONFIG }
