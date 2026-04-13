'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useCountUp } from '@/hooks/use-count-up'

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'gray'
  trend?: { value: number; direction: 'up' | 'down' }
  subtitle?: string
}

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-200 dark:ring-blue-800',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    icon: 'text-yellow-600 dark:text-yellow-400',
    ring: 'ring-yellow-200 dark:ring-yellow-800',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    icon: 'text-green-600 dark:text-green-400',
    ring: 'ring-green-200 dark:ring-green-800',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    icon: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-200 dark:ring-red-800',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    icon: 'text-purple-600 dark:text-purple-400',
    ring: 'ring-purple-200 dark:ring-purple-800',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    icon: 'text-gray-600 dark:text-gray-400',
    ring: 'ring-gray-200 dark:ring-gray-800',
  },
}

/** Parse a value like "24h" or "98%" into { num: 24, suffix: "h" } */
function parseValue(value: number | string): { num: number; suffix: string } | null {
  if (typeof value === 'number') return { num: value, suffix: '' }
  const match = String(value).match(/^([\d.]+)(.*)$/)
  if (!match) return null
  return { num: parseFloat(match[1]), suffix: match[2] }
}

function AnimatedValue({ value }: { value: number | string }) {
  const parsed = parseValue(value)
  const animated = useCountUp(parsed ? Math.round(parsed.num) : 0)
  if (!parsed) return <>{value}</>
  return <>{animated}{parsed.suffix}</>
}

export function StatCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  subtitle,
}: StatCardProps) {
  const colors = COLOR_MAP[color]

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1',
            colors.bg,
            colors.ring
          )}
        >
          <Icon className={cn('size-5', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-semibold tabular-nums">
              <AnimatedValue value={value} />
            </p>
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.direction === 'up'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
