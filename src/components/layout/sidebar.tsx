'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Ticket,
  Building2,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Link2,
  Brain,
  Timer,
  Key,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarUser {
  profile: {
    full_name: string
    avatar_url: string | null
  }
  isInternal: boolean
  role: string | null
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  internalOnly?: boolean
  children?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'Clientes', href: '/clients', icon: Building2 },
  { label: 'Usuários', href: '/users', icon: Users },
  { label: 'Base de Conhecimento', href: '/knowledge-base', icon: BookOpen },
  { label: 'Relatórios', href: '/reports', icon: BarChart3 },
  {
    label: 'Configurações',
    href: '/settings',
    icon: Settings,
    internalOnly: true,
    children: [
      { label: 'Integrações', href: '/settings/integrations', icon: Link2 },
      { label: 'IA', href: '/settings/ai', icon: Brain },
      { label: 'SLA', href: '/settings/sla', icon: Timer },
      { label: 'API Keys', href: '/settings/api-keys', icon: Key },
      { label: 'Templates', href: '/settings/templates', icon: FileText },
    ],
  },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith('/settings')
  )
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const isInWizard = pathname === '/tickets/new'

  const handleNavClick = useCallback(
    (href: string, e: React.MouseEvent) => {
      if (isInWizard && href !== '/tickets/new') {
        e.preventDefault()
        setPendingHref(href)
      }
    },
    [isInWizard]
  )

  const confirmNavigation = useCallback(() => {
    const href = pendingHref
    setPendingHref(null)
    if (href) {
      router.push(href)
    }
  }, [pendingHref, router])

  function isActive(href: string) {
    if (href === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-border px-4">
        {collapsed ? (
          <img
            src="/favicon.png"
            alt="AWFood"
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-md object-contain"
          />
        ) : (
          <img
            src="/logo.png"
            alt="AWFood Suporte"
            width={140}
            height={36}
            className="h-8 w-auto max-w-[140px] shrink-0 object-contain"
          />
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <TooltipProvider>
          <nav className="flex flex-col gap-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              if (item.internalOnly && !user.isInternal) return null

              const Icon = item.icon
              const active = isActive(item.href)
              const hasChildren = item.children && item.children.length > 0

              if (hasChildren && !collapsed) {
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate text-left">
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-3.5 transition-transform',
                          settingsOpen && 'rotate-180'
                        )}
                      />
                    </button>
                    {settingsOpen && (
                      <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon
                          const childActive = isActive(child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={(e) => handleNavClick(child.href, e)}
                              className={cn(
                                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                childActive
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                              )}
                            >
                              <ChildIcon className="size-3.5 shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              const linkContent = (
                <Link
                  href={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={<span />}>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return (
                <div key={item.href}>{linkContent}</div>
              )
            })}
          </nav>
        </TooltipProvider>
      </ScrollArea>

      <Separator />

      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 py-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      <Separator />

      {/* User section */}
      <div
        className={cn(
          'flex items-center gap-2 p-3',
          collapsed && 'justify-center px-2'
        )}
      >
        <Avatar size="sm">
          {user.profile.avatar_url && (
            <AvatarImage
              src={user.profile.avatar_url}
              alt={user.profile.full_name}
            />
          )}
          <AvatarFallback>
            {getInitials(user.profile.full_name)}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex flex-1 items-center gap-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.profile.full_name}
              </p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <Button
                type="submit"
                variant="ghost"
                size="icon-xs"
                aria-label="Sair"
              >
                <LogOut className="size-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </aside>

    {/* Alert when leaving wizard */}
    <AlertDialog open={!!pendingHref} onOpenChange={(open) => !open && setPendingHref(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar novo ticket?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está criando um novo ticket. Se sair agora, todas as informações preenchidas serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar criando</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={confirmNavigation}
          >
            Sair e descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}
