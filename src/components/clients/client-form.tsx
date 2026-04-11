'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import type { OrgType } from '@/types'

interface EditableOrg {
  id: string
  name: string
  slug: string
  type: OrgType
  parent_org_id?: string | null
  logo_url?: string | null
}

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  slug: z.string().min(2, 'Slug deve ter ao menos 2 caracteres').regex(
    /^[a-z0-9-]+$/,
    'Slug deve conter apenas letras minusculas, numeros e hifens'
  ),
  type: z.enum(['client', 'whitelabel'] as const),
  parent_org_id: z.string().nullable().optional(),
  logo_url: z.string().url('URL invalida').nullable().optional(),
})

type ClientFormValues = z.infer<typeof clientSchema>

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editOrg?: EditableOrg | null
}

export function ClientFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editOrg,
}: ClientFormDialogProps) {
  const isEdit = !!editOrg

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    defaultValues: {
      name: editOrg?.name ?? '',
      slug: editOrg?.slug ?? '',
      type: (editOrg?.type as 'client' | 'whitelabel') ?? 'client',
      parent_org_id: editOrg?.parent_org_id ?? null,
      logo_url: editOrg?.logo_url ?? null,
    },
  })

  const nameValue = watch('name')
  const typeValue = watch('type')

  // Auto-generate slug from name (only for new)
  useEffect(() => {
    if (!isEdit && nameValue) {
      setValue('slug', slugify(nameValue))
    }
  }, [nameValue, isEdit, setValue])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset({
        name: editOrg?.name ?? '',
        slug: editOrg?.slug ?? '',
        type: (editOrg?.type as 'client' | 'whitelabel') ?? 'client',
        parent_org_id: editOrg?.parent_org_id ?? null,
        logo_url: editOrg?.logo_url ?? null,
      })
    }
  }, [open, editOrg, reset])

  // Fetch whitelabel orgs for parent selection
  const { data: whitelabelOrgs } = useQuery<EditableOrg[]>({
    queryKey: ['whitelabel-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/organizations?type=whitelabel&per_page=100')
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const url = isEdit
        ? `/api/organizations/${editOrg!.id}`
        : '/api/organizations'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao salvar')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Cliente atualizado' : 'Cliente criado com sucesso')
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const onSubmit = (values: ClientFormValues) => {
    // Validate with zod manually
    const result = clientSchema.safeParse(values)
    if (!result.success) {
      const firstError = result.error.issues[0]
      toast.error(firstError?.message ?? 'Dados invalidos')
      return
    }
    createMutation.mutate(result.data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados da organizacao'
              : 'Crie uma nova organizacao para um cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Nome</Label>
            <Input
              id="org-name"
              placeholder="Nome da organizacao"
              {...register('name')}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              placeholder="slug-da-organizacao"
              {...register('slug')}
              aria-invalid={!!errors.slug}
            />
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Identificador unico, gerado automaticamente a partir do nome
            </p>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    <SelectItem value="whitelabel">Whitelabel</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {typeValue === 'whitelabel' && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted p-2">
                Organizacoes whitelabel podem ter sub-clientes vinculados.
                Cada sub-cliente herda configuracoes da organizacao pai.
              </p>
            )}
          </div>

          {/* Parent org */}
          {typeValue === 'client' && (whitelabelOrgs ?? []).length > 0 && (
            <div className="space-y-1.5">
              <Label>Organizacao pai (opcional)</Label>
              <Controller
                name="parent_org_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? 'none'}
                    onValueChange={(val: string | null) =>
                      field.onChange(val === 'none' ? null : val)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {(whitelabelOrgs ?? []).map((wl) => (
                        <SelectItem key={wl.id} value={wl.id}>
                          {wl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Vincule como sub-cliente de uma organizacao whitelabel
              </p>
            </div>
          )}

          {/* Logo URL */}
          <div className="space-y-1.5">
            <Label htmlFor="org-logo">URL do Logo (opcional)</Label>
            <Input
              id="org-logo"
              placeholder="https://exemplo.com/logo.png"
              {...register('logo_url')}
              aria-invalid={!!errors.logo_url}
            />
            {errors.logo_url && (
              <p className="text-xs text-destructive">
                {errors.logo_url.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? 'Salvando...'
                : isEdit
                  ? 'Salvar'
                  : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
