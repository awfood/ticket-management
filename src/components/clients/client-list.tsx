'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Users,
  Ticket,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ClientFormDialog } from '@/components/clients/client-form'
import { useUser } from '@/hooks/use-user'
import type { Organization, OrgType } from '@/types'

interface OrgWithCounts extends Organization {
  members_count: number
  tickets_count: number
  children_count: number
}

interface OrgListResponse {
  data: OrgWithCounts[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

const TYPE_LABELS: Record<OrgType, string> = {
  internal: 'Interno',
  client: 'Cliente',
  whitelabel: 'Whitelabel',
}

const TYPE_VARIANTS: Record<OrgType, 'default' | 'secondary' | 'outline'> = {
  internal: 'default',
  client: 'secondary',
  whitelabel: 'outline',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function ExpandableRow({ org }: { org: OrgWithCounts }) {
  const [expanded, setExpanded] = useState(false)

  const { data: children, isLoading } = useQuery<OrgWithCounts[]>({
    queryKey: ['org-children', org.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations?parent_id=${org.id}`
      )
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    enabled: expanded && org.children_count > 0,
  })

  return (
    <>
      <TableRow className="cursor-pointer">
        <TableCell>
          {org.type === 'whitelabel' && org.children_count > 0 ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </Button>
          ) : (
            <div className="size-6" />
          )}
        </TableCell>
        <TableCell>
          <Link
            href={`/clients/${org.id}`}
            className="flex items-center gap-2 font-medium text-foreground hover:underline"
          >
            <Building2 className="size-4 text-muted-foreground" />
            {org.name}
          </Link>
        </TableCell>
        <TableCell>
          <Badge variant={TYPE_VARIANTS[org.type]}>
            {TYPE_LABELS[org.type]}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {org.parent ? (
            <Link
              href={`/clients/${org.parent.id}`}
              className="hover:underline"
            >
              {org.parent.name}
            </Link>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" />
            {org.members_count}
          </span>
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Ticket className="size-3.5" />
            {org.tickets_count}
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(org.created_at)}
        </TableCell>
      </TableRow>
      {expanded && org.children_count > 0 && (
        <>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="bg-muted/30">
                <div className="flex items-center gap-2 pl-8">
                  <Skeleton className="h-4 w-48" />
                </div>
              </TableCell>
            </TableRow>
          ) : (
            (children ?? []).map((child) => (
              <TableRow key={child.id} className="bg-muted/20">
                <TableCell>
                  <div className="ml-3 border-l-2 border-muted-foreground/20 pl-3" />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clients/${child.id}`}
                    className="flex items-center gap-2 text-sm text-foreground hover:underline"
                  >
                    <Globe className="size-3.5 text-muted-foreground" />
                    {child.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    Sub-cliente
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {org.name}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="size-3.5" />
                    {child.members_count}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Ticket className="size-3.5" />
                    {child.tickets_count}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(child.created_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </>
      )}
    </>
  )
}

export function ClientListClient() {
  const user = useUser()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [page, setPage] = useState(1)

  const queryParams = new URLSearchParams()
  queryParams.set('page', String(page))
  queryParams.set('per_page', '20')
  if (typeFilter !== 'all') {
    queryParams.set('type', typeFilter)
  }
  if (search.trim()) {
    queryParams.set('search', search.trim())
  }

  const { data, isLoading, refetch } = useQuery<OrgListResponse>({
    queryKey: ['organizations', page, typeFilter, search],
    queryFn: async () => {
      const res = await fetch(`/api/organizations?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar organizacoes')
      return res.json()
    },
  })

  const organizations = data?.data ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as organizacoes e seus membros
          </p>
        </div>
        {user.isInternal && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Novo Cliente
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(val: string | null) => {
              setTypeFilter(val ?? 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="whitelabel">Whitelabel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Org. Pai</TableHead>
              <TableHead>Membros</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente encontrado
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => (
                <ExpandableRow key={org.id} org={org} />
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Pagina {page} de {totalPages} ({data?.total ?? 0} resultados)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Proximo
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create dialog */}
      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false)
          refetch()
        }}
      />
    </div>
  )
}
