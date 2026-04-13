'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WizardStepTemplate } from './wizard-step-template'
import { WizardStepFields } from './wizard-step-fields'
import { WizardStepDescription } from './wizard-step-description'
import { WizardStepClassification } from './wizard-step-classification'
import { WizardStepReview } from './wizard-step-review'

export interface WizardData {
  // Step 1: Template
  templateId: string | null
  templateName: string | null
  // Step 2: Template fields
  fieldValues: Record<string, string>
  // Step 3: Description
  title: string
  description: string
  descriptionHtml: string
  // Step 4: Classification
  orgId: string
  priority: string
  category: string
  affectedService: string
  environment: string
  impact: string
  tags: string[]
  stepsToReproduce: string
  expectedBehavior: string
  actualBehavior: string
}

const INITIAL_DATA: WizardData = {
  templateId: null,
  templateName: null,
  fieldValues: {},
  title: '',
  description: '',
  descriptionHtml: '',
  orgId: '',
  priority: 'medium',
  category: '',
  affectedService: '',
  environment: '',
  impact: '',
  tags: [],
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
}

const STEPS = [
  { number: 1, label: 'Template' },
  { number: 2, label: 'Campos' },
  { number: 3, label: 'Descricao' },
  { number: 4, label: 'Classificacao' },
  { number: 5, label: 'Revisao' },
]

export function TicketWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)
  const [stepValid, setStepValid] = useState<Record<number, boolean>>({
    1: false,
    2: true,
    3: false,
    4: false,
    5: true,
  })

  const updateData = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const setValid = useCallback((step: number, valid: boolean) => {
    setStepValid((prev) => {
      if (prev[step] === valid) return prev
      return { ...prev, [step]: valid }
    })
  }, [])

  // Determine effective steps: skip step 2 if no template selected
  const shouldSkipFields = data.templateId === null

  function getNextStep(current: number): number {
    if (current === 1 && shouldSkipFields) return 3
    return current + 1
  }

  function getPrevStep(current: number): number {
    if (current === 3 && shouldSkipFields) return 1
    return current - 1
  }

  function isStepAccessible(step: number): boolean {
    if (step === 2 && shouldSkipFields) return false
    return true
  }

  function goNext() {
    const next = getNextStep(currentStep)
    if (next <= 5) setCurrentStep(next)
  }

  function goPrev() {
    const prev = getPrevStep(currentStep)
    if (prev >= 1) setCurrentStep(prev)
  }

  function goToStep(step: number) {
    if (!isStepAccessible(step)) return
    // Only allow going to completed or current steps
    if (step <= currentStep) {
      setCurrentStep(step)
    }
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          description_html: data.descriptionHtml || null,
          org_id: data.orgId,
          priority: data.priority || 'medium',
          category: data.category || null,
          affected_service: data.affectedService || null,
          environment: data.environment || null,
          impact: data.impact || null,
          tags: data.tags,
          steps_to_reproduce: data.stepsToReproduce || null,
          expected_behavior: data.expectedBehavior || null,
          actual_behavior: data.actualBehavior || null,
          metadata: {
            template_id: data.templateId,
            template_name: data.templateName,
            template_field_values: data.templateId ? data.fieldValues : undefined,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro ao criar ticket')
      }
      return res.json()
    },
    onSuccess: (ticket) => {
      toast.success('Ticket criado com sucesso!')
      router.push(`/tickets/${ticket.id}`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar ticket')
    },
  })

  function isStepCompleted(step: number): boolean {
    if (step === 2 && shouldSkipFields) return true
    if (step < currentStep) return true
    return false
  }

  return (
    <div className="flex flex-col">
      {/* Header with close button */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">Novo Ticket</h1>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => router.push('/tickets')}
        >
          <X className="size-4" />
          Cancelar
        </Button>
      </div>

      {/* Stepper */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <nav aria-label="Progresso" className="mx-auto max-w-3xl">
          <ol className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.number
              const isCompleted = isStepCompleted(step.number)
              const isSkipped = step.number === 2 && shouldSkipFields
              const isClickable = step.number <= currentStep && !isSkipped

              return (
                <li
                  key={step.number}
                  className={cn(
                    'flex items-center',
                    idx < STEPS.length - 1 && 'flex-1'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => isClickable && goToStep(step.number)}
                    disabled={!isClickable}
                    className={cn(
                      'flex flex-col items-center gap-1.5 transition-colors',
                      isClickable && 'cursor-pointer',
                      !isClickable && 'cursor-default'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                        isActive &&
                          'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25',
                        isCompleted &&
                          !isActive &&
                          'border-primary bg-primary/10 text-primary',
                        !isActive &&
                          !isCompleted &&
                          !isSkipped &&
                          'border-muted-foreground/30 text-muted-foreground',
                        isSkipped && 'border-muted/50 text-muted-foreground/40'
                      )}
                    >
                      {isCompleted && !isActive ? (
                        <Check className="size-4" />
                      ) : (
                        step.number
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isActive && 'text-primary',
                        isCompleted && !isActive && 'text-foreground',
                        !isActive &&
                          !isCompleted &&
                          !isSkipped &&
                          'text-muted-foreground',
                        isSkipped && 'text-muted-foreground/40 line-through'
                      )}
                    >
                      {step.label}
                    </span>
                  </button>

                  {/* Connector line */}
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'mx-3 mt-[-1.25rem] h-0.5 flex-1 rounded-full transition-colors',
                        isCompleted ? 'bg-primary/40' : 'bg-border'
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          {currentStep === 1 && (
            <WizardStepTemplate
              data={data}
              updateData={updateData}
              setValid={(v) => setValid(1, v)}
            />
          )}
          {currentStep === 2 && (
            <WizardStepFields
              data={data}
              updateData={updateData}
              setValid={(v) => setValid(2, v)}
            />
          )}
          {currentStep === 3 && (
            <WizardStepDescription
              data={data}
              updateData={updateData}
              setValid={(v) => setValid(3, v)}
            />
          )}
          {currentStep === 4 && (
            <WizardStepClassification
              data={data}
              updateData={updateData}
              setValid={(v) => setValid(4, v)}
            />
          )}
          {currentStep === 5 && (
            <WizardStepReview
              data={data}
              isSubmitting={submitMutation.isPending}
              onSubmit={() => submitMutation.mutate()}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          {currentStep === 1 ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => router.push('/tickets')}
            >
              <ChevronLeft className="size-4" />
              Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              className="gap-1.5"
            >
              <ChevronLeft className="size-4" />
              Voltar
            </Button>
          )}

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Passo {currentStep} de 5
          </div>

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!stepValid[currentStep]}
              className="gap-1.5"
            >
              Proximo
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !data.title || !data.orgId}
              className="gap-1.5"
            >
              {submitMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Criar Ticket
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
