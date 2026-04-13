'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface DevPromptConfig {
  extra_notes?: string
  ai_has_context: boolean
}

interface DevPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (config: DevPromptConfig) => void
}

export function DevPromptDialog({
  open,
  onOpenChange,
  onConfirm,
}: DevPromptDialogProps) {
  const [extraNotes, setExtraNotes] = useState('')
  const [aiHasContext, setAiHasContext] = useState(false)

  function handleOpenChange(value: boolean) {
    if (!value) {
      // Reset ao fechar
      setExtraNotes('')
      setAiHasContext(false)
    }
    onOpenChange(value)
  }

  function handleConfirm() {
    onConfirm({
      extra_notes: extraNotes.trim() || undefined,
      ai_has_context: aiHasContext,
    })
    setExtraNotes('')
    setAiHasContext(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Prompt de Desenvolvimento</DialogTitle>
          <DialogDescription>
            Configure as opcoes antes de gerar o prompt para a ferramenta de IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Toggle: IA ja conhece a plataforma */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="ai-has-context"
                checked={aiHasContext}
                onCheckedChange={(checked) =>
                  setAiHasContext(checked === true)
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <label
                  htmlFor="ai-has-context"
                  className="text-sm font-medium cursor-pointer leading-tight"
                >
                  IA ja possui conhecimento da plataforma
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Marque se a IA de destino ja conhece a arquitetura AWFood (ex: Claude Code com CLAUDE.md configurado). Isso gera um prompt mais conciso, sem repetir informacoes de linguagem, frameworks e estrutura do projeto.
                </p>
              </div>
            </div>
            {aiHasContext && (
              <div className="ml-7 rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                O prompt sera gerado sem contexto de arquitetura, focando apenas no problema e na implementacao.
              </div>
            )}
          </div>

          {/* Textarea: observacoes extras */}
          <div className="space-y-1.5">
            <Label htmlFor="extra-notes" className="text-sm font-medium">
              Observacoes extras{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="extra-notes"
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Ex: Focar na tabela orders, considerar que o campo status mudou recentemente, priorizar solucao sem migration..."
              rows={4}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Adicione contexto extra, restricoes ou instrucoes especificas que serao incluidas no prompt gerado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-1.5">
            <Sparkles className="size-4" />
            Gerar Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
