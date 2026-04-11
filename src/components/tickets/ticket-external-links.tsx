'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  Plus,
  Loader2,
  GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { TicketExternalLink, IntegrationProvider, LinkType } from '@/types'

interface TicketExternalLinksProps {
  ticketId: string
}

function ProviderIcon({
  provider,
  className,
}: {
  provider: IntegrationProvider
  className?: string
}) {
  switch (provider) {
    case 'github':
      return <GitBranch className={className} />
    case 'jira':
      // Jira doesn't have a lucide icon, use a styled square
      return (
        <span
          className={
            'inline-flex items-center justify-center rounded bg-blue-600 text-white text-[8px] font-bold ' +
            (className ?? 'size-4')
          }
        >
          J
        </span>
      )
    default:
      return <ExternalLink className={className} />
  }
}

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  created_from: 'Criado a partir de',
  related: 'Relacionado',
  blocks: 'Bloqueia',
  blocked_by: 'Bloqueado por',
}

export function TicketExternalLinks({ ticketId }: TicketExternalLinksProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [provider, setProvider] = useState<IntegrationProvider>('jira')
  const [externalId, setExternalId] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('related')

  const { data: links, isLoading } = useQuery({
    queryKey: ['ticket-external-links', ticketId],
    queryFn: async (): Promise<TicketExternalLink[]> => {
      const res = await fetch(`/api/tickets/${ticketId}/external-links`)
      if (!res.ok) throw new Error('Erro ao carregar links externos')
      return res.json()
    },
  })

  const addLink = useMutation({
    mutationFn: async (payload: {
      provider: IntegrationProvider
      external_id: string
      external_url: string
      link_type: LinkType
    }) => {
      const res = await fetch(`/api/tickets/${ticketId}/external-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ?? 'Erro ao vincular'
        )
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ticket-external-links', ticketId],
      })
      toast.success('Link externo adicionado!')
      resetForm()
      setDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function resetForm() {
    setProvider('jira')
    setExternalId('')
    setExternalUrl('')
    setLinkType('related')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!externalId.trim() || !externalUrl.trim()) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }
    addLink.mutate({
      provider,
      external_id: externalId.trim(),
      external_url: externalUrl.trim(),
      link_type: linkType,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Links Externos</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="ghost" size="icon-xs">
                <Plus className="size-3.5" />
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular issue externa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Provedor</Label>
                  <Select
                    value={provider}
                    onValueChange={(val) => {
                      if (val) setProvider(val as IntegrationProvider)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jira">Jira</SelectItem>
                      <SelectItem value="github">GitHub</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de relacao</Label>
                  <Select
                    value={linkType}
                    onValueChange={(val) => {
                      if (val) setLinkType(val as LinkType)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  ID externo <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder={
                    provider === 'jira' ? 'PROJ-123' : 'owner/repo#123'
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder={
                    provider === 'jira'
                      ? 'https://jira.atlassian.net/browse/PROJ-123'
                      : 'https://github.com/owner/repo/issues/123'
                  }
                />
              </div>

              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" type="button" />}
                >
                  Cancelar
                </DialogClose>
                <Button type="submit" disabled={addLink.isPending}>
                  {addLink.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Vincular
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : links && links.length > 0 ? (
        <div className="space-y-1.5">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/50 transition-colors"
            >
              <ProviderIcon
                provider={link.provider}
                className="size-4 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="truncate font-mono text-xs">
                  {link.external_id}
                </span>
                {link.external_status && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {link.external_status}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {LINK_TYPE_LABELS[link.link_type] ?? link.link_type}
              </span>
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhum link externo vinculado.
        </p>
      )}
    </div>
  )
}
