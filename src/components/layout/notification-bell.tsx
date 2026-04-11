'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Ticket, MessageSquare, AlertTriangle, AtSign, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Notification, NotificationType } from '@/types'

interface NotificationBellProps {
  userId: string
}

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  ticket_assigned: Ticket,
  new_comment: MessageSquare,
  status_changed: ArrowRight,
  sla_breach: AlertTriangle,
  mention: AtSign,
}

const TYPE_COLORS: Record<NotificationType, string> = {
  ticket_assigned: 'text-blue-500',
  new_comment: 'text-muted-foreground',
  status_changed: 'text-green-600',
  sla_breach: 'text-destructive',
  mention: 'text-purple-500',
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Placeholder: will be wired to Supabase realtime subscription
  useEffect(() => {
    // TODO: subscribe to notifications table via Supabase realtime
    // const channel = supabase
    //   .channel('notifications')
    //   .on('postgres_changes', {
    //     event: 'INSERT',
    //     schema: 'public',
    //     table: 'notifications',
    //     filter: `user_id=eq.${userId}`,
    //   }, (payload) => {
    //     setNotifications((prev) => [payload.new as Notification, ...prev])
    //   })
    //   .subscribe()
    //
    // return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    )
    // TODO: call Supabase to mark all as read
    // supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', userId).eq('is_read', false)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notificacoes" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <PopoverHeader className="flex flex-row items-center justify-between p-3 pb-2">
          <PopoverTitle>Notificacoes</PopoverTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground"
            >
              Marcar todas como lidas
            </Button>
          )}
        </PopoverHeader>
        <Separator />
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificacao
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] ?? Bell
                const iconColor = TYPE_COLORS[notification.type] ?? 'text-muted-foreground'

                return (
                  <Link
                    key={notification.id}
                    href={
                      notification.ticket_id
                        ? `/tickets/${notification.ticket_id}`
                        : '#'
                    }
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50',
                      !notification.is_read && 'bg-muted/30'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted',
                        iconColor
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p
                        className={cn(
                          'truncate text-sm',
                          !notification.is_read && 'font-medium'
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTimeAgo(notification.created_at)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Ver todas as notificacoes
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
