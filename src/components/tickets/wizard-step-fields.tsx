'use client'

import { useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { TemplateFieldRenderer, type TemplateFieldDef } from './template-field-renderer'
import type { WizardData } from './ticket-wizard'

interface Template {
  id: string
  name: string
  title_template: string
  body_template: string
  fields: TemplateFieldDef[]
  default_priority: string
  default_category: string | null
  default_service: string | null
  default_tags: string[]
}

interface WizardStepFieldsProps {
  data: WizardData
  updateData: (partial: Partial<WizardData>) => void
  setValid: (valid: boolean) => void
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
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol')
      )
        return trimmed
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
    })
    .filter(Boolean)
    .join('')
}

export function WizardStepFields({ data, updateData, setValid }: WizardStepFieldsProps) {
  const templateId = data.templateId

  const { data: response, isLoading } = useQuery<{ data: Template }>({
    queryKey: ['ticket-template', templateId],
    queryFn: async () => {
      const res = await fetch(`/api/templates/${templateId}`)
      if (!res.ok) throw new Error('Erro ao carregar template')
      return res.json()
    },
    enabled: !!templateId,
  })

  const template = response?.data ?? null
  const fields: TemplateFieldDef[] = template?.fields ?? []
  const fieldValues = data.fieldValues

  // Validate required fields
  const requiredFields = useMemo(
    () => fields.filter((f) => f.required),
    [fields]
  )

  const allRequiredFilled = useMemo(
    () => requiredFields.every((f) => fieldValues[f.key]?.trim()),
    [requiredFields, fieldValues]
  )

  useEffect(() => {
    // If no fields exist, always valid
    if (fields.length === 0) {
      setValid(true)
      return
    }
    setValid(allRequiredFilled)
  }, [fields.length, allRequiredFilled, setValid])

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      const next = { ...data.fieldValues, [key]: value }
      updateData({ fieldValues: next })
    },
    [data.fieldValues, updateData]
  )

  // Process template when fields change: replace placeholders and pre-fill title/description
  useEffect(() => {
    if (!template) return

    let title = template.title_template
    let body = template.body_template

    for (const [key, value] of Object.entries(fieldValues)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      title = title.replace(pattern, value || `[${key}]`)
      body = body.replace(pattern, value || `[${key}]`)
    }

    // Replace remaining unfilled placeholders
    title = title.replace(/\{\{(\w+)\}\}/g, '[$1]')
    body = body.replace(/\{\{(\w+)\}\}/g, '[$1]')

    const html = markdownToHtml(body)

    updateData({
      title,
      description: body,
      descriptionHtml: html,
    })
  }, [template, fieldValues, updateData])

  if (!templateId) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum template selecionado. Este passo sera pulado.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Este template nao possui campos adicionais.
        </p>
        <p className="text-xs text-muted-foreground">
          Clique em &quot;Proximo&quot; para continuar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Preencha os campos do template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete as informacoes necessarias para o template &quot;{template?.name}&quot;.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const isFullWidth =
            field.type === 'textarea' || field.type === 'file'

          return (
            <div
              key={field.key}
              className={isFullWidth ? 'sm:col-span-2' : undefined}
            >
              <TemplateFieldRenderer
                field={field}
                value={fieldValues[field.key] ?? ''}
                onChange={(v) => handleFieldChange(field.key, v)}
              />
            </div>
          )
        })}
      </div>

      {requiredFields.length > 0 && !allRequiredFilled && (
        <p className="text-xs text-muted-foreground">
          * Preencha todos os campos obrigatorios para continuar.
        </p>
      )}
    </div>
  )
}
