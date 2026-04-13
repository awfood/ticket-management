'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, FileText, GripVertical,
  Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TagInput } from '@/components/shared/tag-input'

interface TemplateField {
  key: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  options?: string[]
  validation?: { min?: number; max?: number; pattern?: string }
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
  sort_order: number
  is_active: boolean
  created_at: string
}

const CATEGORY_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'integration', label: 'Integracao' },
  { value: 'configuration', label: 'Configuracao' },
  { value: 'bug', label: 'Bug' },
  { value: 'support', label: 'Suporte' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' },
]

export function TemplatesSettings() {
  const queryClient = useQueryClient()
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: Template[] }>({
    queryKey: ['templates-admin'],
    queryFn: async () => {
      const res = await fetch('/api/templates?active=false')
      if (!res.ok) throw new Error('Erro ao carregar templates')
      return res.json()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates-admin'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-admin'] })
      setDeleteId(null)
      toast.success('Template excluido')
    },
  })

  const templates = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates de Tickets</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie templates pre-definidos para criacao rapida de tickets
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          Novo Template
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Campos</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <FileText className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum template criado</p>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id} className={!t.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <GripVertical className="size-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.category && (
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label ?? t.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PRIORITY_OPTIONS.find((p) => p.value === t.default_priority)?.label ?? t.default_priority}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {t.fields.length} campos
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: t.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditTemplate(t)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Dialog */}
      <TemplateFormDialog
        open={createOpen || !!editTemplate}
        template={editTemplate}
        onClose={() => {
          setCreateOpen(false)
          setEditTemplate(null)
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Template Form Dialog ---
function TemplateFormDialog({
  open,
  template,
  onClose,
}: {
  open: boolean
  template: Template | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [titleTemplate, setTitleTemplate] = useState('')
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [defaultPriority, setDefaultPriority] = useState('medium')
  const [tags, setTags] = useState<string[]>([])
  const [fields, setFields] = useState<TemplateField[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Populate form when template changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (template) {
      setName(template.name)
      setDescription(template.description ?? '')
      setCategory(template.category ?? '')
      setTitleTemplate(template.title_template)
      setBodyTemplate(template.body_template)
      setDefaultPriority(template.default_priority)
      setTags(template.default_tags)
      setFields(template.fields)
    } else {
      setName('')
      setDescription('')
      setCategory('')
      setTitleTemplate('')
      setBodyTemplate('')
      setDefaultPriority('medium')
      setTags([])
      setFields([])
    }
  }, [template])

  function addField() {
    setFields((prev) => [
      ...prev,
      { key: '', label: '', type: 'text', placeholder: '', required: false, options: [] },
    ])
  }

  function updateField(index: number, updates: Partial<TemplateField>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!name || !titleTemplate || !bodyTemplate) {
      toast.error('Preencha nome, titulo e corpo do template')
      return
    }

    // Auto-generate keys from labels
    const processedFields = fields
      .filter((f) => f.label)
      .map((f) => ({
        ...f,
        key: f.key || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      }))

    setSubmitting(true)
    try {
      const payload = {
        name,
        description: description || null,
        category: category || null,
        title_template: titleTemplate,
        body_template: bodyTemplate,
        default_priority: defaultPriority,
        default_tags: tags,
        fields: processedFields,
      }

      const url = template ? `/api/templates/${template.id}` : '/api/templates'
      const method = template ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Erro ao salvar')

      queryClient.invalidateQueries({ queryKey: ['templates-admin'] })
      toast.success(template ? 'Template atualizado' : 'Template criado')
      onClose()
    } catch {
      toast.error('Erro ao salvar template')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar template' : 'Novo template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ativar integracao iFood" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(val) => setCategory(val ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descricao</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descricao breve do template" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Titulo do ticket *</Label>
              <Input value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} placeholder="Use {{campo}} para variaveis" />
              <p className="text-[11px] text-muted-foreground">Ex: Cadastro de novo cliente: {'{{nome_empresa}}'}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade padrao</Label>
              <Select value={defaultPriority} onValueChange={(val) => setDefaultPriority(val ?? 'medium')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Corpo do ticket *</Label>
            <Textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              placeholder="Texto do ticket com {{variaveis}}"
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags padrao</Label>
            <TagInput value={tags} onChange={setTags} placeholder="Adicionar tag..." />
          </div>

          {/* Dynamic fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Campos do formulario</Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="size-3.5 mr-1" />
                Adicionar campo
              </Button>
            </div>
            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum campo adicionado. Campos permitem que o usuario preencha informacoes
                que serao substituidas nas variaveis {'{{...}}'} do template.
              </p>
            )}
            {fields.map((field, index) => (
              <div key={index} className="rounded border bg-muted/50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="grid gap-2 flex-1 sm:grid-cols-4">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Label do campo"
                      className="text-sm"
                    />
                    <Input
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      placeholder="Chave (auto)"
                      className="text-sm font-mono"
                    />
                    <Select
                      value={field.type ?? 'text'}
                      onValueChange={(val) => updateField(index, { type: val ?? 'text' })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="textarea">Texto longo</SelectItem>
                        <SelectItem value="number">Numero</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="currency">Moeda (R$)</SelectItem>
                        <SelectItem value="date">Data</SelectItem>
                        <SelectItem value="file">Arquivo</SelectItem>
                        <SelectItem value="select">Selecao</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="wysiwyg">Texto rico (WYSIWYG)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required ?? false}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                          className="rounded"
                        />
                        Obrigatorio
                      </label>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
                {/* Placeholder input */}
                <Input
                  value={field.placeholder ?? ''}
                  onChange={(e) => updateField(index, { placeholder: e.target.value })}
                  placeholder="Placeholder / dica para o usuario"
                  className="text-xs"
                />
                {/* Options for select type */}
                {field.type === 'select' && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Opcoes (uma por linha)</p>
                    <Textarea
                      value={(field.options ?? []).join('\n')}
                      onChange={(e) => updateField(index, {
                        options: e.target.value.split('\n').filter((o) => o.trim()),
                      })}
                      placeholder="Opcao 1&#10;Opcao 2&#10;Opcao 3"
                      rows={3}
                      className="text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Salvando...' : template ? 'Salvar alteracoes' : 'Criar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
