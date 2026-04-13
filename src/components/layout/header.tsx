'use client'

import { useRouter } from 'next/navigation'
import { Search, User, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/layout/notification-bell'

interface HeaderUser {
  id: string
  profile: {
    full_name: string
    avatar_url: string | null
  }
}

interface HeaderProps {
  title: string
  user: HeaderUser
  breadcrumbs?: { label: string; href?: string }[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Header({ title, user, breadcrumbs }: HeaderProps) {
  const router = useRouter()

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const query = formData.get('search') as string
    if (query.trim()) {
      router.push(`/tickets?search=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      {/* Left: title + breadcrumbs */}
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && (
                  <span className="text-muted-foreground/50">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="truncate text-base font-semibold text-foreground">
            {title}
          </h1>
        )}
      </div>

      {/* Center: search */}
      <form
        onSubmit={handleSearch}
        className="hidden w-full max-w-sm md:block"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Buscar tickets..."
            className="pl-8 h-9 text-sm"
          />
        </div>
      </form>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <NotificationBell userId={user.id} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Menu do usuario"
              />
            }
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
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.profile.full_name}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push('/settings/profile')}
              >
                <User className="size-4" />
                Meu perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
              >
                <Settings className="size-4" />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // POST to logout endpoint
                const form = document.createElement('form')
                form.method = 'POST'
                form.action = '/api/auth/logout'
                document.body.appendChild(form)
                form.submit()
              }}
            >
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
