'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Shield,
  Clock,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface ApiKeyResponse {
  id: string
  name: string
  key_prefix: string
  org_id: string | null
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  organization?: { id: string; name: string; slug: string } | null
  token?: string
}

const ALL_SCOPES = [
  { value: 'tickets.read', label: 'Ler tickets', description: 'Listar e visualizar tickets' },
  { value: 'tickets.write', label: 'Criar/atualizar tickets', description: 'Criar e modificar tickets' },
  { value: 'comments.write', label: 'Comentar em tickets', description: 'Adicionar comentarios em tickets' },
  { value: 'orgs.read', label: 'Ler organizacoes', description: 'Listar e visualizar organizacoes' },
  { value: 'orgs.write', label: 'Criar organizacoes', description: 'Criar novas organizacoes (apenas keys globais)' },
]

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes}min atras`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atras`
  const days = Math.floor(hours / 24)
  return `${days}d atras`
}

export function ApiKeysSettings() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [orgId, setOrgId] = useState<string>('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])

  const { data: keysData, isLoading } = useQuery<{ data: ApiKeyResponse[] }>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await fetch('/api/api-keys')
      if (!res.ok) throw new Error('Erro ao carregar API keys')
      return res.json()
    },
  })

  const { data: orgsData } = useQuery<{ data: { id: string; name: string; slug: string }[] }>({
    queryKey: ['organizations-for-keys'],
    queryFn: async () => {
      const res = await fetch('/api/organizations?per_page=100')
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          org_id: orgId || null,
          scopes: selectedScopes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar API key')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setCreatedToken(data.data.token)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key criada com sucesso')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao revogar key')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setRevokeId(null)
      toast.success('API key revogada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function resetForm() {
    setName('')
    setOrgId('')
    setSelectedScopes([])
    setCreatedToken(null)
    setCopied(false)
  }

  function handleCopy() {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  const keys = keysData?.data ?? []
  const orgs = orgsData?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie chaves de API para integracoes externas
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger>
            <Button size="sm">
              <Plus className="size-4 mr-1.5" />
              Nova API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            {createdToken ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key criada</DialogTitle>
                  <DialogDescription>
                    Copie o token abaixo. Ele nao sera exibido novamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all select-all">
                      {createdToken}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="size-4 text-green-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                    <p>
                      Guarde este token em local seguro. Apos fechar este
                      dialog, nao sera possivel ve-lo novamente.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateOpen(false)
                      resetForm()
                    }}
                  >
                    Fechar
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Nova API Key</DialogTitle>
                  <DialogDescription>
                    Crie uma chave para integracoes externas como Claude
                    Cowork, automacoes CI/CD, etc.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Claude Cowork, CI Pipeline"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Organizacao (opcional)</Label>
                    <Select value={orgId} onValueChange={(val) => setOrgId(val ?? '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Global (todas as orgs)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">
                          Global (todas as orgs)
                        </SelectItem>
                        {orgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Keys globais podem acessar qualquer organizacao. Keys
                      vinculadas acessam apenas a org selecionada.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Permissoes (scopes)</Label>
                    {ALL_SCOPES.map((scope) => (
                      <label
                        key={scope.value}
                        className="flex items-start gap-2.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedScopes.includes(scope.value)}
                          onCheckedChange={() => toggleScope(scope.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium">
                            {scope.label}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {scope.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateOpen(false)
                      resetForm()
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={
                      !name ||
                      selectedScopes.length === 0 ||
                      createMutation.isPending
                    }
                  >
                    {createMutation.isPending ? 'Criando...' : 'Criar API Key'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* API docs hint */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="size-4" />
            Como usar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-3 text-sm font-mono space-y-1">
            <p className="text-muted-foreground"># Criar ticket via API</p>
            <p>
              curl -X POST {typeof window !== 'undefined' ? window.location.origin : 'https://suporte.awfood.com.br'}/api/v1/tickets \
            </p>
            <p className="pl-4">-H &quot;Authorization: Bearer ak_...&quot; \</p>
            <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
            <p className="pl-4">
              -d &#39;{'{"title":"Bug","description":"...","priority":"high"}'}&#39;
            </p>
          </div>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Base URL:</strong> /api/v1/</p>
            <p><strong>Endpoints:</strong> /tickets, /tickets/:id, /tickets/:id/comments, /organizations</p>
          </div>
        </CardContent>
      </Card>

      {/* Keys table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Prefixo</TableHead>
              <TableHead>Organizacao</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Ultimo uso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Key className="size-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma API key criada
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id} className={!key.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {key.key_prefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    {key.organization ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <Building2 className="size-3 text-muted-foreground" />
                        {key.organization.name}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Global
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge
                          key={scope}
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {timeAgo(key.last_used_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {key.is_active ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Revogada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRevokeId(key.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Revoke confirmation */}
      <AlertDialog
        open={!!revokeId}
        onOpenChange={(open) => !open && setRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao desativara a key permanentemente. Integracoes que
              utilizam esta key deixarao de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeId && revokeMutation.mutate(revokeId)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
