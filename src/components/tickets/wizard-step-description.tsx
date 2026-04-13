'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/shared/rich-text-editor'
import type { WizardData } from './ticket-wizard'

interface WizardStepDescriptionProps {
  data: WizardData
  updateData: (partial: Partial<WizardData>) => void
  setValid: (valid: boolean) => void
}

export function WizardStepDescription({ data, updateData, setValid }: WizardStepDescriptionProps) {
  const [titleTouched, setTitleTouched] = useState(false)
  const [descTouched, setDescTouched] = useState(false)

  const titleError = titleTouched && data.title.length < 5
    ? 'Titulo deve ter pelo menos 5 caracteres'
    : null
  const descError = descTouched && data.description.length < 10
    ? 'Descricao deve ter pelo menos 10 caracteres'
    : null

  useEffect(() => {
    const isValid = data.title.length >= 5 && data.description.length >= 10
    setValid(isValid)
  }, [data.title, data.description, setValid])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Descreva o ticket</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione um titulo claro e uma descricao detalhada do problema ou solicitacao.
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="wizard-title" className="text-sm font-medium">
          Titulo <span className="text-destructive">*</span>
        </Label>
        <Input
          id="wizard-title"
          value={data.title}
          onChange={(e) => {
            updateData({ title: e.target.value })
            if (!titleTouched) setTitleTouched(true)
          }}
          onBlur={() => setTitleTouched(true)}
          placeholder="Descreva brevemente o problema ou solicitacao"
          className="h-11 text-base"
          aria-invalid={!!titleError}
        />
        {titleError && (
          <p className="text-xs text-destructive">{titleError}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Descricao <span className="text-destructive">*</span>
        </Label>
        <RichTextEditor
          content={data.descriptionHtml}
          onChange={(html, text) => {
            updateData({
              descriptionHtml: html,
              description: text,
            })
            if (!descTouched) setDescTouched(true)
          }}
          placeholder="Descreva o problema em detalhes. Quanto mais informacoes, melhor."
          minHeight="280px"
        />
        {descError && (
          <p className="text-xs text-destructive">{descError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Dica: use formatacao rica para destacar informacoes importantes.
        </p>
      </div>
    </div>
  )
}
