'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(
  () => import('@/components/shared/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
  { loading: () => <div className="h-40 rounded-lg bg-muted animate-pulse" /> }
)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/shared/tag-input'
import { TemplateSelector } from '@/components/tickets/template-selector'
import { useUser } from '@/hooks/use-user'
import type {
  TicketPriority,
  TicketCategory,
  AffectedService,
  TicketImpact,
  Organization,
} from '@/types'

const ticketSchema = z.object({
  title: z.string().min(5, 'Título deve ter pelo menos 5 caracteres'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string().optional(),
  affected_service: z.string().optional(),
  environment: z.string().optional(),
  impact: z.string().optional(),
  org_id: z.string().min(1, 'Organização é obrigatória'),
  steps_to_reproduce: z.string().optional(),
  expected_behavior: z.string().optional(),
  actual_behavior: z.string().optional(),
})

type TicketFormData = z.infer<typeof ticketSchema>

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Solicitação de recurso' },
  { value: 'support', label: 'Suporte' },
  { value: 'billing', label: 'Cobrança' },
  { value: 'integration', label: 'Integração' },
  { value: 'configuration', label: 'Configuração' },
]

const SERVICE_OPTIONS: { value: AffectedService; label: string }[] = [
  { value: 'painel', label: 'Painel' },
  { value: 'pdv', label: 'PDV' },
  { value: 'api', label: 'API' },
  { value: 'admin', label: 'Admin' },
  { value: 'site', label: 'Site' },
]

const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'Produção' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Desenvolvimento' },
]

const IMPACT_OPTIONS: { value: TicketImpact; label: string }[] = [
  { value: 'single_user', label: 'Um usuário' },
  { value: 'multiple_users', label: 'Vários usuários' },
  { value: 'all_users', label: 'Todos os usuários' },
  { value: 'system_wide', label: 'Sistema inteiro' },
]

export function TicketForm() {
  const router = useRouter()
  const user = useUser()
  const [submitting, setSubmitting] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TicketFormData>({
    defaultValues: {
      priority: 'medium',
      org_id: '',
    },
  })

  const selectedOrgId = watch('org_id')
  const selectedPriority = watch('priority')
  const selectedCategory = watch('category')
  const selectedService = watch('affected_service')
  const selectedEnvironment = watch('environment')
  const selectedImpact = watch('impact')

  // Load organizations
  useEffect(() => {
    if (user.isInternal) {
      // Internal users can see all orgs
      fetch('/api/organizations')
        .then((res) => {
          if (res.ok) return res.json()
          return []
        })
        .then((data) => {
          const orgs = Array.isArray(data) ? data : data?.data ?? []
          setOrganizations(orgs)
        })
        .catch(() => {
          // If orgs endpoint doesn't exist yet, use memberships
          const orgs = user.memberships
            .map((m) => m.organization)
            .filter((o): o is Organization => !!o)
          setOrganizations(orgs)
        })
    } else {
      // Client users only see their orgs
      const orgs = user.memberships
        .map((m) => m.organization)
        .filter((o): o is Organization => !!o)
      setOrganizations(orgs)
      // Auto-set org if only one
      if (orgs.length === 1) {
        setValue('org_id', orgs[0].id)
      }
    }
  }, [user, setValue])

  async function onSubmit(data: TicketFormData) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          description_html: descriptionHtml,
          tags,
          category: data.category || null,
          affected_service: data.affected_service || null,
          environment: data.environment || null,
          impact: data.impact || null,
          steps_to_reproduce: data.steps_to_reproduce || null,
          expected_behavior: data.expected_behavior || null,
          actual_behavior: data.actual_behavior || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ?? 'Erro ao criar ticket'
        )
      }

      const ticket = await res.json()
      toast.success('Ticket criado com sucesso!')
      router.push(`/tickets/${ticket.id}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao criar ticket'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function markdownToHtml(md: string): string {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .split('\n\n')
      .map((block) => {
        const trimmed = block.trim()
        if (!trimmed) return ''
        if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) return trimmed
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
      })
      .filter(Boolean)
      .join('')
  }

  function handleTemplateSelect(data: {
    title: string
    description: string
    priority: string
    category: string | null
    affected_service: string | null
    tags: string[]
  }) {
    setValue('title', data.title)
    setValue('description', data.description)
    const html = markdownToHtml(data.description)
    setDescriptionHtml(html)
    if (data.priority) setValue('priority', data.priority as TicketPriority)
    if (data.category) setValue('category', data.category)
    if (data.affected_service) setValue('affected_service', data.affected_service)
    if (data.tags.length > 0) setTags(data.tags)
    toast.success('Template aplicado')
  }

  return (
    <div className="space-y-6">
      <TemplateSelector onSelect={handleTemplateSelect} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            ou preencha manualmente
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            {...register('title', {
              required: 'Título é obrigatório',
              minLength: {
                value: 5,
                message: 'Título deve ter pelo menos 5 caracteres',
              },
            })}
            placeholder="Descreva brevemente o problema ou solicitação"
            aria-invalid={!!errors.title}
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label>
            Descrição <span className="text-destructive">*</span>
          </Label>
          <RichTextEditor
            content={descriptionHtml}
            onChange={(html, text) => {
              setDescriptionHtml(html)
              setValue('description', text, { shouldValidate: true })
            }}
            placeholder="Descreva o problema em detalhes. Quanto mais informações, melhor."
            minHeight="160px"
          />
          {errors.description && (
            <p className="text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Row: Priority, Category, Service */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select
              value={selectedPriority}
              onValueChange={(val) => {
                if (val) setValue('priority', val as TicketPriority)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={selectedCategory ?? ''}
              onValueChange={(val) => setValue('category', val ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Affected Service */}
          <div className="space-y-1.5">
            <Label>Serviço afetado</Label>
            <Select
              value={selectedService ?? ''}
              onValueChange={(val) => setValue('affected_service', val ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row: Org, Environment, Impact */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Organization */}
          <div className="space-y-1.5">
            <Label>
              Organização <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedOrgId}
              onValueChange={(val) => setValue('org_id', val ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.org_id && (
              <p className="text-xs text-destructive">
                {errors.org_id.message}
              </p>
            )}
          </div>

          {/* Environment */}
          <div className="space-y-1.5">
            <Label>Ambiente</Label>
            <Select
              value={selectedEnvironment ?? ''}
              onValueChange={(val) => setValue('environment', val ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Impact */}
          <div className="space-y-1.5">
            <Label>Impacto</Label>
            <Select
              value={selectedImpact ?? ''}
              onValueChange={(val) => setValue('impact', val ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {IMPACT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Steps to reproduce */}
        <div className="space-y-1.5">
          <Label htmlFor="steps_to_reproduce">Passos para reproduzir</Label>
          <Textarea
            id="steps_to_reproduce"
            {...register('steps_to_reproduce')}
            placeholder="1. Abra o painel&#10;2. Navegue ate ...&#10;3. Clique em ..."
            className="min-h-[80px]"
          />
        </div>

        {/* Expected vs Actual behavior */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="expected_behavior">Comportamento esperado</Label>
            <Textarea
              id="expected_behavior"
              {...register('expected_behavior')}
              placeholder="O que deveria acontecer?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="actual_behavior">Comportamento atual</Label>
            <Textarea
              id="actual_behavior"
              {...register('actual_behavior')}
              placeholder="O que está acontecendo?"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagInput
            value={tags}
            onChange={setTags}
            placeholder="Pressione Enter para adicionar tags"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Criar Ticket
        </Button>
      </div>
    </form>
    </div>
  )
}
