'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Search, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { TicketStatusBadge } from './ticket-status-badge'
import { TicketPriorityBadge } from './ticket-priority-badge'
import { JiraImportDialog } from './jira-import-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/hooks/use-user'
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  PaginatedResponse,
} from '@/types'

interface TicketListProps {
  initialFilters?: Record<string, string>
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'waiting_client', label: 'Aguardando cliente' },
  { value: 'waiting_internal', label: 'Aguardando interno' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'critical', label: 'Critica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baixa' },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function buildQueryString(filters: Record<string, string | string[]>): string {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(filters)) {
    if (Array.isArray(val)) {
      if (val.length > 0) params.set(key, val.join(','))
    } else if (val) {
      params.set(key, val)
    }
  }
  return params.toString()
}

async function fetchTickets(
  params: Record<string, string | string[]>
): Promise<PaginatedResponse<Ticket>> {
  const qs = buildQueryString(params)
  const res = await fetch(`/api/tickets?${qs}`)
  if (!res.ok) {
    throw new Error('Erro ao buscar tickets')
  }
  return res.json()
}

export function TicketList({ initialFilters = {} }: TicketListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const user = useUser()

  // Sync filters to URL
  const updateURL = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    if (params.get('page') === '1') params.delete('page')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false })
  }, [searchParams, pathname, router])

  // Debounced URL sync for search input
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateSearchURL = useCallback((value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      updateURL({ search: value, page: '' })
    }, 500)
  }, [updateURL])

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  // Filters state
  const [search, setSearch] = useState(
    initialFilters.search ?? searchParams.get('search') ?? ''
  )
  const [selectedStatuses, setSelectedStatuses] = useState<TicketStatus[]>(() => {
    const param =
      initialFilters.status ?? searchParams.get('status') ?? ''
    return param ? (param.split(',') as TicketStatus[]) : []
  })
  const [selectedPriorities, setSelectedPriorities] = useState<TicketPriority[]>(
    () => {
      const param =
        initialFilters.priority ?? searchParams.get('priority') ?? ''
      return param ? (param.split(',') as TicketPriority[]) : []
    }
  )
  const [page, setPage] = useState(
    parseInt(initialFilters.page ?? searchParams.get('page') ?? '1', 10)
  )
  const [showFilters, setShowFilters] = useState(
    selectedStatuses.length > 0 || selectedPriorities.length > 0
  )

  const perPage = 20

  // Build query params
  const queryParams: Record<string, string | string[]> = {
    page: String(page),
    per_page: String(perPage),
    sort_by: 'created_at',
    sort_order: 'desc',
  }
  if (search) queryParams.search = search
  if (selectedStatuses.length) queryParams.status = selectedStatuses
  if (selectedPriorities.length) queryParams.priority = selectedPriorities

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', queryParams],
    queryFn: () => fetchTickets(queryParams),
  })

  const tickets = data?.data ?? []
  const totalPages = data?.total_pages ?? 1
  const total = data?.total ?? 0

  const toggleStatus = useCallback((status: TicketStatus) => {
    setSelectedStatuses((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
      updateURL({ status: next.join(','), page: '' })
      return next
    })
    setPage(1)
  }, [updateURL])

  const togglePriority = useCallback((priority: TicketPriority) => {
    setSelectedPriorities((prev) => {
      const next = prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
      updateURL({ priority: next.join(','), page: '' })
      return next
    })
    setPage(1)
  }, [updateURL])

  const clearFilters = useCallback(() => {
    setSearch('')
    setSelectedStatuses([])
    setSelectedPriorities([])
    setPage(1)
    updateURL({ search: '', status: '', priority: '', page: '' })
  }, [updateURL])

  const hasActiveFilters =
    search || selectedStatuses.length > 0 || selectedPriorities.length > 0

  // Table columns
  const columns: ColumnDef<Ticket>[] = [
    {
      accessorKey: 'ticket_number',
      header: 'Numero',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.ticket_number}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'title',
      header: 'Titulo',
      cell: ({ row }) => (
        <div className="max-w-[400px]">
          <p className="truncate font-medium">{row.original.title}</p>
          {row.original.tags.length > 0 && (
            <div className="mt-0.5 flex gap-1">
              {row.original.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {row.original.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{row.original.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <TicketStatusBadge status={row.original.status} size="sm" />
      ),
      size: 140,
    },
    {
      accessorKey: 'priority',
      header: 'Prioridade',
      cell: ({ row }) => (
        <TicketPriorityBadge priority={row.original.priority} size="sm" />
      ),
      size: 120,
    },
    {
      accessorKey: 'organization',
      header: 'Organizacao',
      cell: ({ row }) => (
        <span className="truncate text-sm text-muted-foreground">
          {row.original.organization?.name ?? '-'}
        </span>
      ),
      size: 150,
    },
    {
      accessorKey: 'assignee',
      header: 'Responsavel',
      cell: ({ row }) => {
        const assignee = row.original.assignee
        if (!assignee) {
          return (
            <span className="text-sm text-muted-foreground/60">
              Nao atribuido
            </span>
          )
        }
        return (
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              {assignee.avatar_url && (
                <AvatarImage
                  src={assignee.avatar_url}
                  alt={assignee.full_name}
                />
              )}
              <AvatarFallback>
                {getInitials(assignee.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{assignee.full_name}</span>
          </div>
        )
      },
      size: 180,
    },
    {
      accessorKey: 'created_at',
      header: 'Criado em',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.created_at), "dd/MM/yy 'as' HH:mm", {
            locale: ptBR,
          })}
        </span>
      ),
      size: 140,
    },
  ]

  const table = useReactTable({
    data: tickets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tickets</h1>
          {total > 0 && (
            <p className="text-sm text-muted-foreground">
              {total} ticket{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user.isInternal && <JiraImportDialog />}
          <Button onClick={() => router.push('/tickets/new')}>
            <Plus className="size-4" />
            Novo Ticket
          </Button>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
                updateSearchURL(e.target.value)
              }}
              placeholder="Buscar tickets por titulo, numero ou descricao..."
              className="pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                  updateURL({ search: '', page: '' })
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="default"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="size-4" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {selectedStatuses.length + selectedPriorities.length}
              </span>
            )}
          </Button>
        </div>

        {/* Filter chips */}
        {showFilters && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            {/* Status filters */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={
                      'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
                      (selectedStatuses.includes(opt.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority filters */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Prioridade
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePriority(opt.value)}
                    className={
                      'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
                      (selectedPriorities.includes(opt.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearFilters}
                >
                  <X className="size-3" />
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="py-8 text-center text-sm text-destructive">
                    Erro ao carregar tickets. Tente novamente.
                  </div>
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum ticket encontrado.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/tickets/${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); updateURL({ page: String(p) }) }}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); updateURL({ page: String(p) }) }}
              disabled={page >= totalPages}
            >
              Proximo
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
