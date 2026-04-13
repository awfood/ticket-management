'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download, Search, Loader2, CheckCircle2, AlertCircle,
  ExternalLink, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface JiraIssuePreview {
  key: string
  summary: string
  status: string
  priority: string | null
  issueType: string
  assignee: string | null
  updated: string
  url: string
  already_imported: boolean
}

interface JiraProject {
  id: string
  key: string
  name: string
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  failed: number
  tickets: { id: string; ticket_number: string; jira_key: string; action: 'created' | 'updated' }[]
}

export function JiraImportDialog() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [project, setProject] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [orgId, setOrgId] = useState('')
  const [updateExisting, setUpdateExisting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)

  // Fetch Jira projects
  const { data: projectsData } = useQuery<{ data: JiraProject[] }>({
    queryKey: ['jira-projects'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/jira/projects')
      if (!res.ok) return { data: [] }
      const json = await res.json()
      // API returns array directly, normalize to { data: [...] }
      return Array.isArray(json) ? { data: json } : { data: json.data ?? [] }
    },
    enabled: open,
  })

  // Fetch organizations
  const { data: orgsData } = useQuery<{ data: OrgOption[] }>({
    queryKey: ['orgs-for-import'],
    queryFn: async () => {
      const res = await fetch('/api/organizations?per_page=100')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: open,
  })

  // Search Jira issues — auto-fetches when project is selected
  const {
    data: issuesData,
    isLoading: searching,
    refetch: searchIssues,
  } = useQuery<{ data: JiraIssuePreview[] }>({
    queryKey: ['jira-search', project, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ project, max: '50' })
      if (searchQuery) params.set('q', searchQuery)
      const res = await fetch(`/api/integrations/jira/search?${params}`)
      if (!res.ok) throw new Error('Erro ao buscar issues')
      return res.json()
    },
    enabled: !!project,
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/integrations/jira/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKeys: Array.from(selectedKeys),
          org_id: orgId && orgId !== 'internal' ? orgId : undefined,
          update_existing: updateExisting,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao importar')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setResult(data.data)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['jira-search'] })
      const msgs: string[] = []
      if (data.data.imported > 0) msgs.push(`${data.data.imported} importados`)
      if (data.data.updated > 0) msgs.push(`${data.data.updated} atualizados`)
      toast.success(msgs.join(', ') || 'Concluido')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setProject('')
      setSearchQuery('')
      setOrgId('')
      setUpdateExisting(false)
      setSelectedKeys(new Set())
      setResult(null)
    }
  }, [open])

  function handleSearch() {
    if (!project) {
      toast.error('Selecione um projeto')
      return
    }
    searchIssues()
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    const selectable = (issuesData?.data ?? []).filter(
      (i) => !i.already_imported || updateExisting
    )
    if (selectedKeys.size === selectable.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(selectable.map((i) => i.key)))
    }
  }

  const projects = projectsData?.data ?? []
  const orgs = orgsData?.data ?? []
  const issues = issuesData?.data ?? []
  const selectableCount = issues.filter((i) => !i.already_imported || updateExisting).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-4 mr-1.5" />
        Importar do Jira
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        {result ? (
          // Result screen
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                Importacao concluida
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Ignorados</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
              {result.tickets.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Resultado:</p>
                  {result.tickets.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <Check className={cn('size-3.5', t.action === 'updated' ? 'text-blue-600' : 'text-green-600')} />
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {t.action === 'updated' ? 'atualizado' : 'novo'}
                      </Badge>
                      <span className="font-mono text-xs">{t.ticket_number}</span>
                      <span className="text-muted-foreground">&larr;</span>
                      <span className="font-mono text-xs">{t.jira_key}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          // Search & select screen
          <>
            <DialogHeader>
              <DialogTitle>Importar do Jira</DialogTitle>
              <DialogDescription>
                Busque issues recentes no Jira e importe como tickets
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Projeto Jira</Label>
                  <Select value={project} onValueChange={(val) => setProject(val ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.key} value={p.key} label={`${p.key} - ${p.name}`}>
                          {p.key} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Organizacao destino (opcional)</Label>
                  <Select value={orgId} onValueChange={(val) => setOrgId(val ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Interno (sem organizacao)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Interno (sem organizacao)</SelectItem>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                />
                <span className="text-sm">Atualizar tickets ja importados (re-sync do Jira)</span>
              </label>

              <div className="space-y-1">
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por texto (opcional — deixe vazio para listar todos)"
                    onKeyDown={(e) => e.key === 'Enter' && searchIssues()}
                  />
                  <Button
                    variant="outline"
                    onClick={() => searchIssues()}
                    disabled={!project || searching}
                  >
                    {searching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Selecione um projeto para listar as issues recentes. Use o filtro para refinar.
                </p>
              </div>
            </div>

            {/* Issues list */}
            {issues.length > 0 && (
              <div className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    {issues.length} issues encontradas ({selectableCount} importaveis)
                  </p>
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    {selectedKeys.size === selectableCount ? 'Desmarcar tudo' : 'Selecionar tudo'}
                  </Button>
                </div>
                <ScrollArea className="h-[300px] rounded border">
                  <div className="divide-y">
                    {issues.map((issue) => (
                      <label
                        key={issue.key}
                        className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                          issue.already_imported ? 'opacity-50' : ''
                        }`}
                      >
                        <Checkbox
                          checked={selectedKeys.has(issue.key)}
                          onCheckedChange={() => toggleKey(issue.key)}
                          disabled={issue.already_imported && !updateExisting}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-blue-600">
                              {issue.key}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {issue.issueType}
                            </Badge>
                            {issue.priority && (
                              <Badge variant="secondary" className="text-[10px]">
                                {issue.priority}
                              </Badge>
                            )}
                            {issue.already_imported && (
                              <Badge className="bg-green-100 text-green-800 text-[10px]">
                                Ja importado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm mt-0.5 truncate">{issue.summary}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>Status: {issue.status}</span>
                            {issue.assignee && <span>Responsavel: {issue.assignee}</span>}
                          </div>
                        </div>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {issues.length === 0 && project && !searching && issuesData && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhuma issue encontrada</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={selectedKeys.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Download className="size-4 mr-1.5" />
                )}
                Importar {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
