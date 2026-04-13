'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, UserPlus, ShoppingBag, Globe, FileCheck,
  Bug, Printer, HelpCircle, Bike, Search, FilePlus2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { WizardData } from './ticket-wizard'

interface Template {
  id: string
  name: string
  description: string | null
  category: string | null
  icon: string
  title_template: string
  body_template: string
  default_priority: string
  default_category: string | null
  default_service: string | null
  default_tags: string[]
  fields: { key: string; label: string; type?: string; placeholder?: string; required?: boolean; options?: string[] }[]
}

interface WizardStepTemplateProps {
  data: WizardData
  updateData: (partial: Partial<WizardData>) => void
  setValid: (valid: boolean) => void
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, UserPlus, ShoppingBag, Globe, FileCheck,
  Bug, Printer, HelpCircle, Bike,
}

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  integration: 'Integracao',
  configuration: 'Configuracao',
  bug: 'Bug',
  support: 'Suporte',
  billing: 'Cobranca',
  feature_request: 'Recurso',
}

function getIcon(iconName: string) {
  return ICON_MAP[iconName] ?? FileText
}

export function WizardStepTemplate({ data, updateData, setValid }: WizardStepTemplateProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(data.templateId)

  const { data: response, isLoading } = useQuery<{ data: Template[] }>({
    queryKey: ['ticket-templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates')
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })

  const templates = response?.data ?? []

  // Filter templates by search
  const filtered = templates.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false) ||
      (t.category?.toLowerCase().includes(q) ?? false)
    )
  })

  // Set valid on mount/change: always valid because blank is allowed
  useEffect(() => {
    setValid(true)
  }, [setValid])

  function handleSelect(templateId: string | null, template: Template | null) {
    setSelectedId(templateId)

    if (template) {
      updateData({
        templateId: template.id,
        templateName: template.name,
        // Pre-fill defaults from template
        priority: template.default_priority || 'medium',
        category: template.default_category || '',
        affectedService: template.default_service || '',
        tags: template.default_tags ?? [],
      })
    } else {
      // Blank ticket
      updateData({
        templateId: null,
        templateName: null,
        fieldValues: {},
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Escolha um template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione um template para agilizar a criacao do ticket ou comece em branco.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar templates..."
          className="pl-9"
        />
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Blank ticket card */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => handleSelect(null, null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect(null, null)
              }
            }}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-6 transition-all hover:border-primary/40 hover:bg-accent/50',
              selectedId === null
                ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                : 'border-muted-foreground/25'
            )}
          >
            <div
              className={cn(
                'flex size-12 items-center justify-center rounded-xl transition-colors',
                selectedId === null
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
              )}
            >
              <FilePlus2 className="size-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Ticket em branco</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Comece do zero sem template
              </p>
            </div>
          </Card>

          {/* Template cards */}
          {filtered.map((template) => {
            const Icon = getIcon(template.icon)
            const isSelected = selectedId === template.id
            const fieldCount = template.fields?.length ?? 0

            return (
              <Card
                key={template.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(template.id, template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelect(template.id, template)
                  }
                }}
                className={cn(
                  'group relative flex cursor-pointer flex-col gap-3 border-2 p-5 transition-all hover:border-primary/40 hover:bg-accent/50',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                    : 'border-transparent'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{template.name}</p>
                    {template.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {template.category && (
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[template.category] ?? template.category}
                    </Badge>
                  )}
                  {fieldCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {fieldCount} {fieldCount === 1 ? 'campo' : 'campos'}
                    </span>
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {!isLoading && filtered.length === 0 && search && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Search className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhum template encontrado para &quot;{search}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
