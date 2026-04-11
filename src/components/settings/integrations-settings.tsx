'use client'

import { useState, useEffect } from 'react'
import {
  Link2,
  GitBranch,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

// --- Types ---

interface JiraConfig {
  configured: boolean
  data?: {
    id: string
    config: {
      base_url: string
      email: string
      api_token: string
      default_project: string | null
    }
    is_active: boolean
    last_synced_at: string | null
  }
}

interface GitHubConfig {
  configured: boolean
  data?: {
    id: string
    config: {
      access_token: string
      owner: string
      default_repo: string | null
    }
    is_active: boolean
    last_synced_at: string | null
  }
}

interface JiraProject {
  id: string
  key: string
  name: string
}

interface GitHubRepo {
  id: number
  name: string
  fullName: string
}

// --- Main Component ---

export function IntegrationsSettings() {
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null)
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const [jiraRes, ghRes] = await Promise.all([
        fetch('/api/integrations/jira'),
        fetch('/api/integrations/github'),
      ])
      if (jiraRes.ok) setJiraConfig(await jiraRes.json())
      if (ghRes.ok) setGithubConfig(await ghRes.json())
    } catch {
      toast.error('Erro ao carregar configuracoes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfigs()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integracoes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie conexoes com servicos externos
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie conexoes com servicos externos para sincronizar tickets
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <JiraCard config={jiraConfig} onUpdate={fetchConfigs} />
        <GitHubCard config={githubConfig} onUpdate={fetchConfigs} />
      </div>
    </div>
  )
}

// --- Jira Card ---

function JiraCard({
  config,
  onUpdate,
}: {
  config: JiraConfig | null
  onUpdate: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [defaultProject, setDefaultProject] = useState('')
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)

  const isConnected = config?.configured && config?.data?.is_active

  useEffect(() => {
    if (config?.data?.config) {
      setBaseUrl(config.data.config.base_url ?? '')
      setEmail(config.data.config.email ?? '')
      setDefaultProject(config.data.config.default_project ?? '')
    }
  }, [config])

  const fetchProjects = async () => {
    setLoadingProjects(true)
    try {
      const res = await fetch('/api/integrations/jira/projects')
      if (res.ok) {
        setProjects(await res.json())
      }
    } catch {
      // Silently fail — projects are optional
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    if (isConnected && dialogOpen) {
      fetchProjects()
    }
  }, [isConnected, dialogOpen])

  const handleSave = async () => {
    if (!baseUrl || !email || !apiToken) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/integrations/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: baseUrl,
          email,
          api_token: apiToken,
          default_project: defaultProject || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao salvar configuracao')
        return
      }

      toast.success(`Conectado ao Jira como ${data.user}`)
      setDialogOpen(false)
      setApiToken('')
      onUpdate()
    } catch {
      toast.error('Erro ao salvar configuracao do Jira')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!baseUrl || !email || !apiToken) {
      toast.error('Preencha todos os campos para testar')
      return
    }

    setTesting(true)
    try {
      const res = await fetch('/api/integrations/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: baseUrl,
          email,
          api_token: apiToken,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Falha no teste de conexao')
        return
      }

      toast.success(`Conexao OK! Usuario: ${data.user}`)
      onUpdate()
    } catch {
      toast.error('Erro ao testar conexao')
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/jira', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Jira desconectado')
        onUpdate()
      } else {
        toast.error('Erro ao desconectar')
      }
    } catch {
      toast.error('Erro ao desconectar')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded bg-blue-600 text-white text-xs font-bold size-8">
              J
            </span>
            <div>
              <CardTitle className="text-base">Jira</CardTitle>
              <CardDescription>Atlassian Jira Software</CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? (
              <>
                <CheckCircle2 className="size-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <XCircle className="size-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {isConnected && config?.data ? (
          <>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">URL:</span>{' '}
                {config.data.config.base_url}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span>{' '}
                {config.data.config.email}
              </p>
              {config.data.config.default_project && (
                <p>
                  <span className="text-muted-foreground">Projeto padrao:</span>{' '}
                  {config.data.config.default_project}
                </p>
              )}
              {config.data.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  Ultima sincronizacao:{' '}
                  {new Date(config.data.last_synced_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Conecte ao Jira para criar e sincronizar issues diretamente dos
            tickets de suporte.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button variant={isConnected ? 'outline' : 'default'} size="sm">
                <Link2 className="size-4 mr-1" />
                {isConnected ? 'Configurar' : 'Conectar'}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar Jira</DialogTitle>
              <DialogDescription>
                Insira as credenciais para conectar ao Jira
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  URL base <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://sua-empresa.atlassian.net"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Token de API <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={isConnected ? '****' : 'Cole seu token aqui'}
                />
                <p className="text-xs text-muted-foreground">
                  Gere em{' '}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Atlassian API Tokens
                    <ExternalLink className="size-3 inline ml-0.5" />
                  </a>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Projeto padrao</Label>
                {loadingProjects ? (
                  <Skeleton className="h-8 w-full" />
                ) : projects.length > 0 ? (
                  <Select
                    value={defaultProject}
                    onValueChange={(val) => setDefaultProject(val ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.key} value={p.key} label={`${p.key} - ${p.name}`}>
                          {p.key} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={defaultProject}
                    onChange={(e) => setDefaultProject(e.target.value)}
                    placeholder="PROJ"
                  />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || saving}
              >
                {testing && <Loader2 className="size-4 animate-spin mr-1" />}
                Testar Conexao
              </Button>
              <DialogClose render={<Button variant="ghost" size="sm" />}>
                Cancelar
              </DialogClose>
              <Button size="sm" onClick={handleSave} disabled={saving || testing}>
                {saving && <Loader2 className="size-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-destructive hover:text-destructive"
          >
            {disconnecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="ml-1">Desconectar</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

// --- GitHub Card ---

function GitHubCard({
  config,
  onUpdate,
}: {
  config: GitHubConfig | null
  onUpdate: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [owner, setOwner] = useState('')
  const [defaultRepo, setDefaultRepo] = useState('')
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState(false)

  const isConnected = config?.configured && config?.data?.is_active

  useEffect(() => {
    if (config?.data?.config) {
      setOwner(config.data.config.owner ?? '')
      setDefaultRepo(config.data.config.default_repo ?? '')
    }
  }, [config])

  const fetchRepos = async () => {
    setLoadingRepos(true)
    try {
      const res = await fetch('/api/integrations/github/repos')
      if (res.ok) {
        setRepos(await res.json())
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingRepos(false)
    }
  }

  useEffect(() => {
    if (isConnected && dialogOpen) {
      fetchRepos()
    }
  }, [isConnected, dialogOpen])

  const handleSave = async () => {
    if (!accessToken || !owner) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/integrations/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          owner,
          default_repo: defaultRepo || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao salvar configuracao')
        return
      }

      toast.success(`Conectado ao GitHub como ${data.user}`)
      setDialogOpen(false)
      setAccessToken('')
      onUpdate()
    } catch {
      toast.error('Erro ao salvar configuracao do GitHub')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!accessToken || !owner) {
      toast.error('Preencha todos os campos para testar')
      return
    }

    setTesting(true)
    try {
      const res = await fetch('/api/integrations/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          owner,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Falha no teste de conexao')
        return
      }

      toast.success(`Conexao OK! Usuario: ${data.user}`)
      onUpdate()
    } catch {
      toast.error('Erro ao testar conexao')
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/github', { method: 'DELETE' })
      if (res.ok) {
        toast.success('GitHub desconectado')
        onUpdate()
      } else {
        toast.error('Erro ao desconectar')
      }
    } catch {
      toast.error('Erro ao desconectar')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded bg-neutral-900 text-white size-8">
              <GitBranch className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base">GitHub</CardTitle>
              <CardDescription>Issues e Pull Requests</CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? (
              <>
                <CheckCircle2 className="size-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <XCircle className="size-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {isConnected && config?.data ? (
          <>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Owner/Org:</span>{' '}
                {config.data.config.owner}
              </p>
              {config.data.config.default_repo && (
                <p>
                  <span className="text-muted-foreground">Repo padrao:</span>{' '}
                  {config.data.config.default_repo}
                </p>
              )}
              {config.data.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  Ultima sincronizacao:{' '}
                  {new Date(config.data.last_synced_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Conecte ao GitHub para criar issues e acompanhar Pull Requests
            vinculados aos tickets.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button variant={isConnected ? 'outline' : 'default'} size="sm">
                <Link2 className="size-4 mr-1" />
                {isConnected ? 'Configurar' : 'Conectar'}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar GitHub</DialogTitle>
              <DialogDescription>
                Insira as credenciais para conectar ao GitHub
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Token de acesso (PAT) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={isConnected ? '****' : 'ghp_xxxxxxxxxxxx'}
                />
                <p className="text-xs text-muted-foreground">
                  Gere em{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    GitHub Settings &gt; Tokens
                    <ExternalLink className="size-3 inline ml-0.5" />
                  </a>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Owner / Organizacao <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="minha-org ou meu-usuario"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Repositorio padrao</Label>
                {loadingRepos ? (
                  <Skeleton className="h-8 w-full" />
                ) : repos.length > 0 ? (
                  <Select
                    value={defaultRepo}
                    onValueChange={(val) => setDefaultRepo(val ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um repositorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {repos.map((r) => (
                        <SelectItem key={r.name} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={defaultRepo}
                    onChange={(e) => setDefaultRepo(e.target.value)}
                    placeholder="nome-do-repo"
                  />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || saving}
              >
                {testing && <Loader2 className="size-4 animate-spin mr-1" />}
                Testar Conexao
              </Button>
              <DialogClose render={<Button variant="ghost" size="sm" />}>
                Cancelar
              </DialogClose>
              <Button size="sm" onClick={handleSave} disabled={saving || testing}>
                {saving && <Loader2 className="size-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-destructive hover:text-destructive"
          >
            {disconnecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="ml-1">Desconectar</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
