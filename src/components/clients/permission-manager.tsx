'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Shield, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUser } from '@/hooks/use-user'
import type { Permission, RolePermission, UserRole } from '@/types'

interface PermissionsData {
  permissions: Permission[]
  role_permissions: RolePermission[]
}

const MANAGED_ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agente' },
  { value: 'viewer', label: 'Visualizador' },
  { value: 'org_admin', label: 'Admin Org.' },
  { value: 'org_member', label: 'Membro' },
]

const CATEGORY_LABELS: Record<string, string> = {
  tickets: 'Tickets',
  organizations: 'Organizacoes',
  users: 'Usuarios',
  settings: 'Configuracoes',
  reports: 'Relatorios',
  knowledge_base: 'Base de Conhecimento',
  integrations: 'Integracoes',
  ai: 'Inteligencia Artificial',
}

interface PermissionManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PermissionManager({ open, onOpenChange }: PermissionManagerProps) {
  const currentUser = useUser()
  const queryClient = useQueryClient()
  const isSuperAdmin = currentUser.role === 'super_admin'

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await fetch('/api/permissions')
      if (!res.ok) throw new Error('Erro ao carregar permissoes')
      return res.json()
    },
    enabled: open,
  })

  const permissions = data?.permissions ?? []
  const rolePermissions = data?.role_permissions ?? []

  // Group permissions by category
  const grouped = useMemo(() => {
    const groups: Record<string, Permission[]> = {}
    for (const perm of permissions) {
      const cat = perm.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(perm)
    }
    return groups
  }, [permissions])

  // Build a lookup set for quick checking
  const rpLookup = useMemo(() => {
    const set = new Set<string>()
    for (const rp of rolePermissions) {
      set.add(`${rp.role}:${rp.permission_id}`)
    }
    return set
  }, [rolePermissions])

  const toggleMutation = useMutation({
    mutationFn: async ({
      role,
      permissionId,
      enabled,
    }: {
      role: string
      permissionId: string
      enabled: boolean
    }) => {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          permission_id: permissionId,
          enabled,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao atualizar')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function hasPermission(role: string, permissionId: string): boolean {
    return rpLookup.has(`${role}:${permissionId}`)
  }

  function handleToggle(role: string, permissionId: string) {
    if (!isSuperAdmin) return
    const enabled = !hasPermission(role, permissionId)
    toggleMutation.mutate({ role, permissionId, enabled })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Gerenciar Permissoes
          </DialogTitle>
          <DialogDescription>
            Defina quais permissoes cada papel possui no sistema.
            {!isSuperAdmin && ' Apenas super_admin pode alterar permissoes.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          ) : permissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="size-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma permissao cadastrada no sistema
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Adicione permissoes na tabela permissions para configurar o controle de acesso
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, perms]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold mb-2">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">
                            Permissao
                          </TableHead>
                          {MANAGED_ROLES.map((role) => (
                            <TableHead
                              key={role.value}
                              className="text-center w-24"
                            >
                              <span className="text-xs">{role.label}</span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {perms.map((perm) => (
                          <TableRow key={perm.id}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">
                                  {perm.name}
                                </p>
                                {perm.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {perm.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            {MANAGED_ROLES.map((role) => (
                              <TableCell
                                key={role.value}
                                className="text-center"
                              >
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={hasPermission(
                                      role.value,
                                      perm.id
                                    )}
                                    onCheckedChange={() =>
                                      handleToggle(role.value, perm.id)
                                    }
                                    disabled={
                                      !isSuperAdmin ||
                                      toggleMutation.isPending
                                    }
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {toggleMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Salvando alteracao...
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
