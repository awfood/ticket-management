'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  Phone,
  Search,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { InviteMemberDialog } from '@/components/clients/invite-member-dialog'
import { PermissionManager } from '@/components/clients/permission-manager'
import { useUser } from '@/hooks/use-user'
import type { Profile, OrgMember, UserRole } from '@/types'

interface UserWithMemberships extends Profile {
  memberships: (OrgMember & {
    organization?: { id: string; name: string; type: string }
  })[]
}

interface UsersResponse {
  data: UserWithMemberships[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
  org_admin: 'Admin Org.',
  org_member: 'Membro',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  agent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  org_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  org_member: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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

function getInternalRole(user: UserWithMemberships): UserRole | null {
  const internalMembership = user.memberships?.find(
    (m) => m.organization?.type === 'internal' && m.is_active
  )
  return (internalMembership?.role as UserRole) ?? null
}

export function UsersListClient() {
  const currentUser = useUser()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'internal')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '1', 10))
  const [inviteOpen, setInviteOpen] = useState(false)

  const updateURL = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value && !(key === 'tab' && value === 'internal')) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    if (params.get('page') === '1') params.delete('page')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false })
  }, [searchParams, pathname, router])

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateSearchURL = useCallback((value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      updateURL({ search: value, page: '' })
    }, 500)
  }, [updateURL])

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])
  const [permManagerOpen, setPermManagerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithMemberships | null>(null)

  const queryParams = new URLSearchParams()
  queryParams.set('tab', activeTab)
  queryParams.set('page', String(page))
  queryParams.set('per_page', '20')
  if (search.trim()) {
    queryParams.set('search', search.trim())
  }

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users', activeTab, page, search],
    queryFn: async () => {
      const res = await fetch(`/api/users?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar usuarios')
      return res.json()
    },
  })

  const users = data?.data ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a equipe interna e usuarios do sistema
          </p>
        </div>
        <div className="flex gap-2">
          {currentUser.role === 'super_admin' && (
            <Button
              variant="outline"
              onClick={() => setPermManagerOpen(true)}
            >
              <Shield className="size-4" />
              Permissoes
            </Button>
          )}
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            Convidar Usuario
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
          setPage(1)
          updateURL({ tab: val, page: '' })
        }}
      >
        <TabsList>
          <TabsTrigger value="internal">Equipe Interna</TabsTrigger>
          <TabsTrigger value="all">Todos os Usuarios</TabsTrigger>
        </TabsList>

        {/* Search */}
        <Card className="mt-4 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
                updateSearchURL(e.target.value)
              }}
              className="pl-8"
            />
          </div>
        </Card>

        {/* Internal team tab */}
        <TabsContent value="internal">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Permissao</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="size-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum usuario encontrado
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const role = getInternalRole(u)
                    return (
                      <TableRow
                        key={u.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedUser(u)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              {u.avatar_url && (
                                <AvatarImage
                                  src={u.avatar_url}
                                  alt={u.full_name}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(u.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{u.full_name}</p>
                              <p className="text-xs text-muted-foreground">{u.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.phone ?? '-'}
                        </TableCell>
                        <TableCell>
                          {role ? (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                ROLE_COLORS[role]
                              )}
                            >
                              {ROLE_LABELS[role]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.memberships?.some((m) => m.is_active) ? (
                            <Badge variant="secondary">Ativo</Badge>
                          ) : (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(u.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Pagina {page} de {totalPages} ({data?.total ?? 0} resultados)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => { const p = page - 1; setPage(p); updateURL({ page: String(p) }) }}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => { const p = page + 1; setPage(p); updateURL({ page: String(p) }) }}
                  >
                    Proximo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* All users tab */}
        <TabsContent value="all">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Organizacoes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="size-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum usuario encontrado
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            {u.avatar_url && (
                              <AvatarImage
                                src={u.avatar_url}
                                alt={u.full_name}
                              />
                            )}
                            <AvatarFallback>
                              {getInitials(u.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-medium">{u.full_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.is_internal ? (
                          <Badge variant="default">Interno</Badge>
                        ) : (
                          <Badge variant="secondary">Externo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(u.memberships ?? [])
                            .filter((m) => m.is_active)
                            .map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs"
                              >
                                {m.organization?.name ?? m.org_id}
                              </span>
                            ))}
                          {(u.memberships ?? []).filter((m) => m.is_active)
                            .length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              Sem organizacao
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.memberships?.some((m) => m.is_active) ? (
                          <Badge variant="secondary">Ativo</Badge>
                        ) : (
                          <Badge variant="destructive">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(u.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Pagina {page} de {totalPages} ({data?.total ?? 0} resultados)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => { const p = page - 1; setPage(p); updateURL({ page: String(p) }) }}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => { const p = page + 1; setPage(p); updateURL({ page: String(p) }) }}
                  >
                    Proximo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        context="internal"
        onSuccess={() => {
          setInviteOpen(false)
          queryClient.invalidateQueries({ queryKey: ['users'] })
        }}
      />

      {/* Permission manager */}
      <PermissionManager
        open={permManagerOpen}
        onOpenChange={setPermManagerOpen}
      />

      {/* User detail sheet could go here if needed */}
    </div>
  )
}
