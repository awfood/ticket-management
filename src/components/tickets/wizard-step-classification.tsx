'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/shared/tag-input'
import { useUser } from '@/hooks/use-user'
import type { WizardData } from './ticket-wizard'
import type {
  TicketPriority,
  TicketCategory,
  AffectedService,
  TicketImpact,
  Organization,
} from '@/types'

interface WizardStepClassificationProps {
  data: WizardData
  updateData: (partial: Partial<WizardData>) => void
  setValid: (valid: boolean) => void
}

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' },
]

const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Solicitacao de recurso' },
  { value: 'support', label: 'Suporte' },
  { value: 'billing', label: 'Cobranca' },
  { value: 'integration', label: 'Integracao' },
  { value: 'configuration', label: 'Configuracao' },
]

const SERVICE_OPTIONS: { value: AffectedService; label: string }[] = [
  { value: 'painel', label: 'Painel' },
  { value: 'pdv', label: 'PDV' },
  { value: 'api', label: 'API' },
  { value: 'admin', label: 'Admin' },
  { value: 'site', label: 'Site' },
]

const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'Producao' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Desenvolvimento' },
]

const IMPACT_OPTIONS: { value: TicketImpact; label: string }[] = [
  { value: 'single_user', label: 'Um usuario' },
  { value: 'multiple_users', label: 'Varios usuarios' },
  { value: 'all_users', label: 'Todos os usuarios' },
  { value: 'system_wide', label: 'Sistema inteiro' },
]

export function WizardStepClassification({ data, updateData, setValid }: WizardStepClassificationProps) {
  const user = useUser()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgsLoaded, setOrgsLoaded] = useState(false)

  // Load organizations
  useEffect(() => {
    if (user.isInternal) {
      fetch('/api/organizations')
        .then((res) => {
          if (res.ok) return res.json()
          return { data: [] }
        })
        .then((result) => {
          const orgs = Array.isArray(result) ? result : result?.data ?? []
          setOrganizations(orgs)
          setOrgsLoaded(true)
        })
        .catch(() => {
          const orgs = user.memberships
            .map((m) => m.organization)
            .filter((o): o is Organization => !!o)
          setOrganizations(orgs)
          setOrgsLoaded(true)
        })
    } else {
      const orgs = user.memberships
        .map((m) => m.organization)
        .filter((o): o is Organization => !!o)
      setOrganizations(orgs)
      setOrgsLoaded(true)
      // Auto-set org if only one
      if (orgs.length === 1 && !data.orgId) {
        updateData({ orgId: orgs[0].id })
      }
    }
  }, [user, data.orgId, updateData])

  // Validation: orgId is required
  useEffect(() => {
    setValid(!!data.orgId)
  }, [data.orgId, setValid])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Classifique o ticket</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina a prioridade, categoria e demais informacoes de classificacao.
        </p>
      </div>

      {/* Row 1: Organization, Priority, Category */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Organization */}
        <div className="space-y-1.5">
          <Label>
            Organizacao <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.orgId}
            onValueChange={(val) => updateData({ orgId: val ?? '' })}
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
          {orgsLoaded && organizations.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma organizacao disponivel.
            </p>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select
            value={data.priority}
            onValueChange={(val) => updateData({ priority: val ?? 'medium' })}
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
            value={data.category}
            onValueChange={(val) => updateData({ category: val ?? '' })}
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
      </div>

      {/* Row 2: Service, Environment, Impact */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Affected Service */}
        <div className="space-y-1.5">
          <Label>Servico afetado</Label>
          <Select
            value={data.affectedService}
            onValueChange={(val) => updateData({ affectedService: val ?? '' })}
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

        {/* Environment */}
        <div className="space-y-1.5">
          <Label>Ambiente</Label>
          <Select
            value={data.environment}
            onValueChange={(val) => updateData({ environment: val ?? '' })}
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
            value={data.impact}
            onValueChange={(val) => updateData({ impact: val ?? '' })}
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

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagInput
          value={data.tags}
          onChange={(tags) => updateData({ tags })}
          placeholder="Pressione Enter para adicionar tags"
        />
      </div>

      {/* Steps to reproduce */}
      <div className="space-y-1.5">
        <Label htmlFor="wizard-steps">Passos para reproduzir</Label>
        <Textarea
          id="wizard-steps"
          value={data.stepsToReproduce}
          onChange={(e) => updateData({ stepsToReproduce: e.target.value })}
          placeholder={"1. Abra o painel\n2. Navegue ate ...\n3. Clique em ..."}
          className="min-h-[100px]"
        />
      </div>

      {/* Expected vs Actual behavior */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wizard-expected">Comportamento esperado</Label>
          <Textarea
            id="wizard-expected"
            value={data.expectedBehavior}
            onChange={(e) => updateData({ expectedBehavior: e.target.value })}
            placeholder="O que deveria acontecer?"
            className="min-h-[80px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wizard-actual">Comportamento atual</Label>
          <Textarea
            id="wizard-actual"
            value={data.actualBehavior}
            onChange={(e) => updateData({ actualBehavior: e.target.value })}
            placeholder="O que esta acontecendo?"
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  )
}
