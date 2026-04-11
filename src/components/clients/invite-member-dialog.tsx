'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Mail, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserRole } from '@/types'

interface InviteFormValues {
  email: string
  full_name: string
  role: UserRole
}

const INTERNAL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Administrador' },
  { value: 'agent', label: 'Agente' },
  { value: 'viewer', label: 'Visualizador' },
]

const ORG_ROLES: { value: UserRole; label: string }[] = [
  { value: 'org_admin', label: 'Administrador da Organizacao' },
  { value: 'org_member', label: 'Membro' },
]

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId?: string
  context: 'internal' | 'org'
  onSuccess: () => void
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  orgId,
  context,
  onSuccess,
}: InviteMemberDialogProps) {
  const roles = context === 'internal' ? INTERNAL_ROLES : ORG_ROLES
  const defaultRole = context === 'internal' ? 'agent' : 'org_member'

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    defaultValues: {
      email: '',
      full_name: '',
      role: defaultRole as UserRole,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        email: '',
        full_name: '',
        role: defaultRole as UserRole,
      })
    }
  }, [open, defaultRole, reset])

  // For internal invites, we need the internal org id
  const { data: internalOrgId } = useQuery<string | null>({
    queryKey: ['internal-org-id'],
    queryFn: async () => {
      const res = await fetch('/api/organizations?type=internal&per_page=1')
      if (!res.ok) return null
      const json = await res.json()
      const orgs = json.data ?? []
      return orgs[0]?.id ?? null
    },
    enabled: open && context === 'internal',
  })

  const inviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const targetOrgId = context === 'internal' ? internalOrgId : orgId
      if (!targetOrgId) {
        throw new Error('Organizacao nao encontrada')
      }
      const res = await fetch(`/api/organizations/${targetOrgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          full_name: values.full_name || undefined,
          role: values.role,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao convidar membro')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (data.message?.includes('Convite enviado')) {
        toast.success('Convite enviado por email')
      } else {
        toast.success('Membro adicionado com sucesso')
      }
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const onSubmit = (values: InviteFormValues) => {
    if (!values.email || !values.email.includes('@')) {
      toast.error('Informe um email valido')
      return
    }
    inviteMutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {context === 'internal'
              ? 'Convidar Usuario Interno'
              : 'Convidar Membro'}
          </DialogTitle>
          <DialogDescription>
            {context === 'internal'
              ? 'Adicione um novo membro a equipe interna AWFood'
              : 'Adicione um membro a esta organizacao. Se o usuario nao existir, um convite sera enviado por email.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@empresa.com"
                className="pl-8"
                {...register('email', {
                  required: 'Email e obrigatorio',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Email invalido',
                  },
                })}
                aria-invalid={!!errors.email}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nome completo (opcional)</Label>
            <Input
              id="invite-name"
              placeholder="Nome do usuario"
              {...register('full_name')}
            />
            <p className="text-xs text-muted-foreground">
              Se o usuario ja existir, o nome cadastrado sera mantido
            </p>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Permissao</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a permissao" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              <UserPlus className="size-4" />
              {inviteMutation.isPending ? 'Enviando...' : 'Convidar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
