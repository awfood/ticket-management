'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Loader2,
  Save,
  Trash2,
  Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { TicketPriority, SlaPolicy } from '@/types'

// --- Constants ---

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

interface EditablePolicy extends SlaPolicy {
  _dirty?: boolean
  _new?: boolean
}

// --- Main Component ---

export function SLASettings() {
  const [policies, setPolicies] = useState<EditablePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // New policy form state
  const [newName, setNewName] = useState('')
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium')
  const [newFirstResponse, setNewFirstResponse] = useState('4')
  const [newResolution, setNewResolution] = useState('24')
  const [newBusinessHours, setNewBusinessHours] = useState(true)

  const supabase = createClient()

  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sla_policies')
        .select('*')
        .order('priority', { ascending: true })

      if (error) throw error
      setPolicies((data ?? []) as EditablePolicy[])
    } catch {
      toast.error('Erro ao carregar politicas de SLA')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  const handleFieldChange = (
    id: string,
    field: keyof SlaPolicy,
    value: string | number | boolean
  ) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, [field]: value, _dirty: true } : p
      )
    )
  }

  const handleSaveAll = async () => {
    const dirtyPolicies = policies.filter((p) => p._dirty)
    if (dirtyPolicies.length === 0) {
      toast.info('Nenhuma alteracao pendente')
      return
    }

    setSaving(true)
    try {
      for (const policy of dirtyPolicies) {
        const { error } = await supabase
          .from('sla_policies')
          .update({
            name: policy.name,
            priority: policy.priority,
            first_response_hours: policy.first_response_hours,
            resolution_hours: policy.resolution_hours,
            business_hours_only: policy.business_hours_only,
            is_active: policy.is_active,
          })
          .eq('id', policy.id)

        if (error) throw error
      }

      toast.success(`${dirtyPolicies.length} politica(s) atualizada(s)`)
      fetchPolicies()
    } catch {
      toast.error('Erro ao salvar politicas')
    } finally {
      setSaving(false)
    }
  }

  const handleAddPolicy = async () => {
    if (!newName.trim()) {
      toast.error('Nome da politica e obrigatorio')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('sla_policies').insert({
        name: newName.trim(),
        priority: newPriority,
        first_response_hours: parseFloat(newFirstResponse) || 4,
        resolution_hours: parseFloat(newResolution) || 24,
        business_hours_only: newBusinessHours,
        is_active: true,
      })

      if (error) throw error

      toast.success('Politica de SLA criada')
      setDialogOpen(false)
      resetNewForm()
      fetchPolicies()
    } catch {
      toast.error('Erro ao criar politica de SLA')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePolicy = async (id: string) => {
    try {
      const { error } = await supabase.from('sla_policies').delete().eq('id', id)
      if (error) throw error
      toast.success('Politica removida')
      setPolicies((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast.error('Erro ao remover politica')
    }
  }

  const resetNewForm = () => {
    setNewName('')
    setNewPriority('medium')
    setNewFirstResponse('4')
    setNewResolution('24')
    setNewBusinessHours(true)
  }

  const hasDirtyPolicies = policies.some((p) => p._dirty)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Politicas de SLA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure os tempos de resposta e resolucao por prioridade
          </p>
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Politicas de SLA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure os tempos de resposta e resolucao por prioridade
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="size-4 mr-1" />
                  Nova Politica
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Politica de SLA</DialogTitle>
                <DialogDescription>
                  Defina os tempos de resposta e resolucao
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: SLA Padrao - Alta Prioridade"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select
                    value={newPriority}
                    onValueChange={(val) => {
                      if (val) setNewPriority(val as TicketPriority)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>1a Resposta (horas)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={newFirstResponse}
                      onChange={(e) => setNewFirstResponse(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resolucao (horas)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={newResolution}
                      onChange={(e) => setNewResolution(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Somente horario comercial</Label>
                  <Switch
                    checked={newBusinessHours}
                    onCheckedChange={setNewBusinessHours}
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="ghost" size="sm" />}>
                  Cancelar
                </DialogClose>
                <Button size="sm" onClick={handleAddPolicy} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin mr-1" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {hasDirtyPolicies && (
            <Button
              size="sm"
              variant="default"
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Save className="size-4 mr-1" />
              )}
              Salvar Alteracoes
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="size-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Politicas Configuradas</CardTitle>
              <CardDescription>
                Edite diretamente na tabela e clique em Salvar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Timer className="size-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma politica de SLA configurada</p>
              <p className="text-xs mt-1">
                Clique em &quot;Nova Politica&quot; para criar a primeira
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>1a Resposta (h)</TableHead>
                  <TableHead>Resolucao (h)</TableHead>
                  <TableHead>Horario Comercial</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow
                    key={policy.id}
                    className={policy._dirty ? 'bg-yellow-50/50 dark:bg-yellow-950/10' : ''}
                  >
                    <TableCell>
                      <Input
                        value={policy.name}
                        onChange={(e) =>
                          handleFieldChange(policy.id, 'name', e.target.value)
                        }
                        className="h-7 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          PRIORITY_COLORS[policy.priority] as
                            | 'default'
                            | 'secondary'
                            | 'destructive'
                            | 'outline'
                        }
                      >
                        {PRIORITY_LABELS[policy.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={policy.first_response_hours}
                        onChange={(e) =>
                          handleFieldChange(
                            policy.id,
                            'first_response_hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-7 w-20 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={policy.resolution_hours}
                        onChange={(e) =>
                          handleFieldChange(
                            policy.id,
                            'resolution_hours',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-7 w-20 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={policy.business_hours_only}
                        onCheckedChange={(checked) =>
                          handleFieldChange(
                            policy.id,
                            'business_hours_only',
                            checked
                          )
                        }
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={policy.is_active}
                        onCheckedChange={(checked) =>
                          handleFieldChange(policy.id, 'is_active', checked)
                        }
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
