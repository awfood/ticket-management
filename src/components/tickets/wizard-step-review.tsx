'use client'

import {
  FileText, Tag, AlertCircle, Server, Globe2,
  Users, ListChecks, ArrowRight, ArrowLeft, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RichTextViewer } from '@/components/shared/rich-text-editor'
import type { WizardData } from './ticket-wizard'

interface WizardStepReviewProps {
  data: WizardData
  isSubmitting: boolean
  onSubmit: () => void
}

const PRIORITY_MAP: Record<string, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Media', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Critica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const CATEGORY_MAP: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Solicitacao de recurso',
  support: 'Suporte',
  billing: 'Cobranca',
  integration: 'Integracao',
  configuration: 'Configuracao',
}

const SERVICE_MAP: Record<string, string> = {
  painel: 'Painel',
  pdv: 'PDV',
  api: 'API',
  admin: 'Admin',
  site: 'Site',
}

const ENVIRONMENT_MAP: Record<string, string> = {
  production: 'Producao',
  staging: 'Staging',
  development: 'Desenvolvimento',
}

const IMPACT_MAP: Record<string, string> = {
  single_user: 'Um usuario',
  multiple_users: 'Varios usuarios',
  all_users: 'Todos os usuarios',
  system_wide: 'Sistema inteiro',
}

export function WizardStepReview({ data, isSubmitting, onSubmit }: WizardStepReviewProps) {
  const priority = PRIORITY_MAP[data.priority] ?? PRIORITY_MAP.medium
  const hasAdditionalFields =
    data.stepsToReproduce || data.expectedBehavior || data.actualBehavior
  const hasTemplateFields =
    data.templateId && Object.keys(data.fieldValues).length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Revisao do ticket</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira as informacoes antes de criar o ticket.
        </p>
      </div>

      <Card className="overflow-hidden">
        {/* Header section */}
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="size-3.5" />
            <span>
              {data.templateName ? `Template: ${data.templateName}` : 'Ticket em branco'}
            </span>
          </div>
        </div>

        {/* Title and description */}
        <div className="px-6 py-5 space-y-4">
          <h3 className="text-xl font-bold text-foreground leading-tight">
            {data.title || '(Sem titulo)'}
          </h3>

          {data.descriptionHtml ? (
            <RichTextViewer content={data.descriptionHtml} />
          ) : data.description ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {data.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">(Sem descricao)</p>
          )}
        </div>

        <Separator />

        {/* Classification badges */}
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority */}
            <Badge className={cn('text-xs font-medium', priority.className)}>
              <AlertCircle className="mr-1 size-3" />
              {priority.label}
            </Badge>

            {/* Category */}
            {data.category && (
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_MAP[data.category] ?? data.category}
              </Badge>
            )}

            {/* Service */}
            {data.affectedService && (
              <Badge variant="outline" className="text-xs">
                <Server className="mr-1 size-3" />
                {SERVICE_MAP[data.affectedService] ?? data.affectedService}
              </Badge>
            )}

            {/* Environment */}
            {data.environment && (
              <Badge variant="outline" className="text-xs">
                <Globe2 className="mr-1 size-3" />
                {ENVIRONMENT_MAP[data.environment] ?? data.environment}
              </Badge>
            )}

            {/* Impact */}
            {data.impact && (
              <Badge variant="outline" className="text-xs">
                <Users className="mr-1 size-3" />
                {IMPACT_MAP[data.impact] ?? data.impact}
              </Badge>
            )}
          </div>

          {/* Tags */}
          {data.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag className="size-3.5 text-muted-foreground" />
              {data.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] bg-primary/10 text-primary"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Additional fields */}
        {hasAdditionalFields && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-4">
              {data.stepsToReproduce && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Passos para reproduzir
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {data.stepsToReproduce}
                  </p>
                </div>
              )}

              {(data.expectedBehavior || data.actualBehavior) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.expectedBehavior && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Comportamento esperado
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {data.expectedBehavior}
                      </p>
                    </div>
                  )}
                  {data.actualBehavior && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Comportamento atual
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {data.actualBehavior}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Template fields */}
        {hasTemplateFields && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Campos do template
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(data.fieldValues).map(([key, value]) => {
                  if (!value) return null
                  return (
                    <div key={key} className="rounded-md bg-muted/50 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {key}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">
                        {value}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Submit button */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || !data.title || !data.orgId}
        className="w-full gap-2 h-11 text-base"
        size="lg"
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ListChecks className="size-5" />
        )}
        {isSubmitting ? 'Criando ticket...' : 'Criar Ticket'}
      </Button>

      {(!data.title || !data.orgId) && (
        <p className="text-center text-xs text-destructive">
          {!data.title && !data.orgId
            ? 'Titulo e organizacao sao obrigatorios.'
            : !data.title
            ? 'Titulo e obrigatorio.'
            : 'Organizacao e obrigatoria.'}
        </p>
      )}
    </div>
  )
}
