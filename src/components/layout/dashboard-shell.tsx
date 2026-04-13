'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { UserProvider } from '@/hooks/use-user'
import type { UserContext } from '@/types'

interface DashboardShellProps {
  user: UserContext
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarUser = {
    profile: {
      full_name: user.profile.full_name,
      avatar_url: user.profile.avatar_url,
    },
    isInternal: user.isInternal,
    role: user.role,
  }

  const headerUser = {
    id: user.profile.id,
    profile: {
      full_name: user.profile.full_name,
      avatar_url: user.profile.avatar_url,
    },
  }

  return (
    <UserProvider value={user}>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar user={sidebarUser} />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Mobile header bar with hamburger */}
            <div className="flex items-center gap-2 border-b border-border px-2 py-2 lg:hidden">
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Abrir menu"
                  />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <img src="/logo.png" alt="AWFood Suporte" width={100} height={26} className="h-6 w-auto object-contain" />
            </div>

            {/* Desktop header */}
            <div className="hidden lg:block">
              <Header title="Dashboard" user={headerUser} />
            </div>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto bg-muted/30 p-4 lg:p-6">
              <div className="mx-auto max-w-[1400px]">
                {children}
              </div>
            </main>
          </div>

          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <Sidebar user={sidebarUser} />
          </SheetContent>
        </Sheet>
      </div>
    </UserProvider>
  )
}
