'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, UserPlus, ShoppingBag, Globe, FileCheck,
  Bug, Printer, HelpCircle, Bike, ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TemplateField {
  key: string
  label: string
  placeholder?: string
  required?: boolean
}

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
  fields: TemplateField[]
}

interface TemplateSelectorProps {
  onSelect: (data: {
    title: string
    description: string
    priority: string
    category: string | null
    affected_service: string | null
    tags: string[]
  }) => void
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
}

function getIcon(iconName: string) {
  return ICON_MAP[iconName] ?? FileText
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data } = useQuery<{ data: Template[] }>({
    queryKey: ['ticket-templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates')
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })

  const templates = data?.data ?? []

  function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template)
    setFieldValues({})
    setDialogOpen(true)
  }

  function handleApply() {
    if (!selectedTemplate) return

    let title = selectedTemplate.title_template
    let body = selectedTemplate.body_template

    // Replace all {{placeholders}} with field values
    for (const [key, value] of Object.entries(fieldValues)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      title = title.replace(pattern, value || `[${key}]`)
      body = body.replace(pattern, value || `[${key}]`)
    }

    // Replace remaining unfilled placeholders
    title = title.replace(/\{\{(\w+)\}\}/g, '[$1]')
    body = body.replace(/\{\{(\w+)\}\}/g, '[$1]')

    onSelect({
      title,
      description: body,
      priority: selectedTemplate.default_priority,
      category: selectedTemplate.default_category,
      affected_service: selectedTemplate.default_service,
      tags: selectedTemplate.default_tags,
    })

    setDialogOpen(false)
    setSelectedTemplate(null)
    setFieldValues({})
  }

  function updateField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }))
  }

  const requiredFields = selectedTemplate?.fields.filter((f) => f.required) ?? []
  const allRequiredFilled = requiredFields.every((f) => fieldValues[f.key]?.trim())

  if (templates.length === 0) return null

  // Group by category
  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    const cat = t.category ?? 'outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-1">Usar template</h3>
          <p className="text-xs text-muted-foreground">
            Selecione um template para pre-preencher o formulario
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              {items.map((template) => {
                const Icon = getIcon(template.icon)
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {template.name}
                      </p>
                      {template.description && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Fill template fields dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Preencha as informacoes abaixo para gerar o ticket
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              {selectedTemplate?.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-sm">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  <Input
                    value={fieldValues[field.key] ?? ''}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder ?? ''}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-2">
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="flex gap-1.5">
                {selectedTemplate?.default_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={!allRequiredFilled}
                >
                  Aplicar template
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
