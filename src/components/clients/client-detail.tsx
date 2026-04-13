'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit,
  Globe,
  MoreHorizontal,
  Shield,
  Ticket,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { ClientFormDialog } from '@/components/clients/client-form'
import { InviteMemberDialog } from '@/components/clients/invite-member-dialog'
import { useUser } from '@/hooks/use-user'
import type { OrgMember, OrgType, Organization, UserRole } from '@/types'

interface OrgDetail extends Omit<Organization, 'children'> {
  members: OrgMember[]
  members_count: number
  children: { id: string; name: string; slug: string; type: OrgType; created_at: string }[]
  children_count: number
  recent_tickets: {
    id: string
    ticket_number: string
    title: string
    status: string
    priority: string
    created_at: string
  }[]
}

const TYPE_LABELS: Record<OrgType, string> = {
  internal: 'Interno',
  client: 'Cliente',
  whitelabel: 'Whitelabel',
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
  org_admin: 'Admin Org.',
  org_member: 'Membro',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_client: 'Aguardando Cliente',
  waiting_internal: 'Aguardando Interno',
  resolved: 'Resolvido',
  closed: 'Fechado',
  cancelled: 'Cancelado',
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-600',
  low: 'text-blue-500',
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

interface ClientDetailViewProps {
  orgId: string
  initialOrg: { id: string; name: string; slug: string; type: string }
}

export function ClientDetailView({ orgId, initialOrg }: ClientDetailViewProps) {
  const user = useUser()
  const queryClient = useQueryClient()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [removeMember, setRemoveMember] = useState<OrgMember | null>(null)

  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}`)
      if (!res.ok) throw new Error('Erro ao carregar a organização. Tente recarregar a página.')
      return res.json()
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Não foi possível remover o membro. Verifique sua conexão.')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Membro removido da organização.')
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      setRemoveMember(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, role }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Não foi possível alterar a função do membro.')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Função do membro atualizada.')
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const isWhitelabel = (org?.type ?? initialOrg.type) === 'whitelabel'

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/clients">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              {org?.name ?? initialOrg.name}
            </h1>
            <Badge variant="outline">
              {TYPE_LABELS[(org?.type ?? initialOrg.type) as OrgType]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {org?.slug ?? initialOrg.slug}
          </p>
        </div>
        {user.isInternal && (
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
            <Edit className="size-3.5" />
            Editar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="members">
            Membros ({org?.members_count ?? 0})
          </TabsTrigger>
          {isWhitelabel && (
            <TabsTrigger value="children">
              Sub-clientes ({org?.children_count ?? 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4" />
                <span className="text-xs font-medium">Tipo</span>
              </div>
              <p className="mt-1 text-sm font-semibold">
                {TYPE_LABELS[(org?.type ?? initialOrg.type) as OrgType]}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span className="text-xs font-medium">Membros</span>
              </div>
              <p className="mt-1 text-sm font-semibold">
                {org?.members_count ?? 0}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Ticket className="size-4" />
                <span className="text-xs font-medium">Tickets Recentes</span>
              </div>
              <p className="mt-1 text-sm font-semibold">
                {org?.recent_tickets?.length ?? 0}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                <span className="text-xs font-medium">Criado em</span>
              </div>
              <p className="mt-1 text-sm font-semibold">
                {org?.created_at ? formatDate(org.created_at) : '-'}
              </p>
            </Card>
          </div>

          {org?.parent && (
            <Card className="mt-4 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Organização Pai
              </p>
              <Link
                href={`/clients/${org.parent.id}`}
                className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
              >
                <Globe className="size-4" />
                {org.parent.name}
              </Link>
            </Card>
          )}

          {org?.settings && Object.keys(org.settings).length > 0 && (
            <Card className="mt-4 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Configurações
              </p>
              <pre className="text-xs text-muted-foreground bg-muted rounded-md p-2 overflow-auto">
                {JSON.stringify(org.settings, null, 2)}
              </pre>
            </Card>
          )}
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members">
          <Card>
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="text-sm font-medium">Membros da organização</h3>
              {user.isInternal && (
                <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
                  <Users className="size-3.5" />
                  Convidar Membro
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(org?.members ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum membro nesta organização. Use o botão acima para convidar.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  (org?.members ?? []).map((member) => (
                    <TableRow
                      key={member.id}
                      className={cn(!member.is_active && 'opacity-50')}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            {member.profile?.avatar_url && (
                              <AvatarImage
                                src={member.profile.avatar_url}
                                alt={member.profile?.full_name ?? ''}
                              />
                            )}
                            <AvatarFallback>
                              {getInitials(
                                member.profile?.full_name ?? 'U'
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {member.profile?.full_name ?? 'Usuario'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.user_id}
                      </TableCell>
                      <TableCell>
                        {user.isInternal ? (
                          <Select
                            value={member.role}
                            onValueChange={(val: string | null) => {
                              if (val) {
                                changeRoleMutation.mutate({
                                  memberId: member.id,
                                  role: val,
                                })
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="org_admin">
                                Admin Org.
                              </SelectItem>
                              <SelectItem value="org_member">Membro</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">
                            {ROLE_LABELS[member.role] ?? member.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(member.joined_at)}
                      </TableCell>
                      <TableCell>
                        {user.isInternal && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-xs" />
                              }
                            >
                              <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setRemoveMember(member)}
                              >
                                <UserMinus className="size-4" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Children (sub-clients) tab */}
        {isWhitelabel && (
          <TabsContent value="children">
            <Card>
              <div className="p-4 pb-2">
                <h3 className="text-sm font-medium">Sub-clientes</h3>
                <p className="text-xs text-muted-foreground">
                  Organizações vinculadas como sub-clientes desta whitelabel
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(org?.children ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <p className="text-sm text-muted-foreground">
                          Nenhum sub-cliente vinculado ainda.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (org?.children ?? []).map((child) => (
                      <TableRow key={child.id}>
                        <TableCell>
                          <Link
                            href={`/clients/${child.id}`}
                            className="flex items-center gap-2 font-medium hover:underline"
                          >
                            <Globe className="size-3.5 text-muted-foreground" />
                            {child.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {child.slug}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(child.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {/* Tickets tab */}
        <TabsContent value="tickets">
          <Card>
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="text-sm font-medium">Tickets recentes</h3>
              <Link href={`/tickets?org_id=${orgId}`}>
                <Button variant="outline" size="sm">
                  Ver todos
                </Button>
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(org?.recent_tickets ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum ticket encontrado
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  (org?.recent_tickets ?? []).map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          #{ticket.ticket_number}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {ticket.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {STATUS_LABELS[ticket.status] ?? ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'text-sm font-medium',
                            PRIORITY_COLORS[ticket.priority]
                          )}
                        >
                          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(ticket.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      {org && (
        <ClientFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          editOrg={org ?? null}
          onSuccess={() => {
            setEditDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
          }}
        />
      )}

      {/* Invite member dialog */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        orgId={orgId}
        context="org"
        onSuccess={() => {
          setInviteDialogOpen(false)
          queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
        }}
      />

      {/* Remove member confirmation */}
      <AlertDialog
        open={!!removeMember}
        onOpenChange={(open) => {
          if (!open) setRemoveMember(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro da organização?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeMember?.profile?.full_name ?? 'Este membro'}</strong>{' '}
              perderá acesso a todos os tickets e configurações desta organização imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removeMember) {
                  removeMemberMutation.mutate(removeMember.id)
                }
              }}
            >
              <Trash2 className="size-4" />
              Remover membro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
