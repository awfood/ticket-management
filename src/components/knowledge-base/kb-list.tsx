'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Search,
  Plus,
  BookOpen,
  Tag,
  Calendar,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { KnowledgeBaseArticle, PaginatedResponse } from '@/types'

const CATEGORIES = [
  { value: '', label: 'Todas categorias' },
  { value: 'geral', label: 'Primeiros Passos' },
  { value: 'cardapio', label: 'Cardápio e Produtos' },
  { value: 'integracao', label: 'Integrações' },
  { value: 'pdv', label: 'PDV e Vendas' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'pagamento', label: 'Pagamentos' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'cadastros', label: 'Cadastros' },
  { value: 'promocoes', label: 'Promoções' },
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'configuracao', label: 'Configurações' },
  { value: 'troubleshooting', label: 'Problemas' },
  { value: 'pedidos', label: 'Pedidos' },
]

const SCORE_FILTERS = [
  { value: '', label: 'Qualquer score' },
  { value: '90-100', label: 'Alto (90-100)' },
  { value: '70-89', label: 'Médio (70-89)' },
  { value: '50-69', label: 'Baixo (50-69)' },
  { value: '0-49', label: 'Crítico (0-49)' },
]

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 90) return 'text-green-600'
  if (score >= 70) return 'text-yellow-600'
  if (score >= 50) return 'text-orange-500'
  return 'text-red-500'
}

function getScoreIcon(score: number | null) {
  if (score === null) return null
  if (score >= 70) return ShieldCheck
  if (score >= 50) return ShieldAlert
  return ShieldQuestion
}

function getScoreLabel(score: number | null): string {
  if (score === null) return ''
  if (score >= 90) return 'Alta confiança'
  if (score >= 70) return 'Média confiança'
  if (score >= 50) return 'Baixa confiança'
  return 'Revisão necessária'
}

async function fetchArticles(
  search: string,
  category: string,
  published: string,
  scoreFilter: string,
  page: number
): Promise<PaginatedResponse<KnowledgeBaseArticle>> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: '12',
  })
  if (search) params.set('search', search)
  if (category) params.set('category', category)
  if (published) params.set('published', published)
  if (scoreFilter) {
    const [min, max] = scoreFilter.split('-')
    params.set('min_score', min)
    params.set('max_score', max)
  }

  const res = await fetch(`/api/knowledge-base?${params}`)
  if (!res.ok) throw new Error('Erro ao carregar artigos')
  return res.json()
}

async function semanticSearch(
  query: string
): Promise<KnowledgeBaseArticle[]> {
  const res = await fetch('/api/knowledge-base/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error('Erro na busca semântica')
  const data = await res.json()
  return data.results ?? []
}

function getExcerpt(content: string, maxLen = 120): string {
  if (!content) return ''
  if (content.length <= maxLen) return content
  return content.slice(0, maxLen).trimEnd() + '...'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function KBList() {
  const user = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Read initial values from URL
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [published, setPublished] = useState(searchParams.get('published') ?? '')
  const [scoreFilter, setScoreFilter] = useState(searchParams.get('score') ?? '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '1', 10))
  const [semanticMode, setSemanticMode] = useState(searchParams.get('semantic') === '1')

  // Sync filters to URL without full page reload
  const updateURL = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    // Remove page=1 from URL (default)
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
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const {
    data: articlesResult,
    isLoading: articlesLoading,
  } = useQuery({
    queryKey: ['kb-articles', search, category, published, scoreFilter, page],
    queryFn: () => fetchArticles(search, category, published, scoreFilter, page),
    enabled: !semanticMode,
  })

  const {
    data: semanticResults,
    isLoading: semanticLoading,
    refetch: runSemanticSearch,
  } = useQuery({
    queryKey: ['kb-semantic', search],
    queryFn: () => semanticSearch(search),
    enabled: false,
  })

  const handleSearch = () => {
    if (semanticMode && search.trim()) {
      runSemanticSearch()
      updateURL({ search, semantic: '1', page: '' })
    } else {
      setPage(1)
      updateURL({ search, page: '' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const isLoading = semanticMode ? semanticLoading : articlesLoading
  const articles = semanticMode
    ? semanticResults ?? []
    : articlesResult?.data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Artigos e documentação de suporte
          </p>
        </div>
        {user.isInternal && (
          <Button onClick={() => router.push('/knowledge-base/new')}>
            <Plus className="size-4" data-icon="inline-start" />
            Novo Artigo
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); updateSearchURL(e.target.value) }}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>

        <Button
          variant={semanticMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => { const next = !semanticMode; setSemanticMode(next); updateURL({ semantic: next ? '1' : '' }) }}
          title="Busca semântica com IA"
        >
          <Sparkles className="size-3.5" data-icon="inline-start" />
          Semântica
        </Button>

        <Select value={category} onValueChange={(v) => { const val = v ?? ''; setCategory(val); setPage(1); updateURL({ category: val, page: '' }) }}>
          <SelectTrigger>
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {user.isInternal && (
          <Select value={published} onValueChange={(v) => { const val = v ?? ''; setPublished(val); setPage(1); updateURL({ published: val, page: '' }) }}>
            <SelectTrigger>
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="true">Publicados</SelectItem>
              <SelectItem value="false">Rascunhos</SelectItem>
            </SelectContent>
          </Select>
        )}

        {user.isInternal && (
          <Select value={scoreFilter} onValueChange={(v) => { const val = v ?? ''; setScoreFilter(val); setPage(1); updateURL({ score: val, page: '' }) }}>
            <SelectTrigger>
              <SelectValue placeholder="Qualquer score" />
            </SelectTrigger>
            <SelectContent>
              {SCORE_FILTERS.map((sf) => (
                <SelectItem key={sf.value} value={sf.value}>
                  {sf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Articles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            Nenhum artigo encontrado
          </p>
          {user.isInternal && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/knowledge-base/new')}
            >
              Criar primeiro artigo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <a
              key={article.id}
              href={`/knowledge-base/${article.id}`}
              className="block"
            >
              <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm line-clamp-2 flex-1">
                      {article.title}
                    </h3>
                    {!article.is_published && user.isInternal && (
                      <Badge variant="secondary" className="shrink-0">
                        Rascunho
                      </Badge>
                    )}
                  </div>

                  {article.category && (
                    <Badge variant="outline" className="text-[10px]">
                      {article.category}
                    </Badge>
                  )}

                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {getExcerpt(article.content)}
                  </p>

                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <Tag className="size-2.5" />
                          {tag}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{article.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="size-2.5" />
                      {formatDate(article.updated_at)}
                    </div>
                    {article.confidence_score !== null && article.confidence_score !== undefined && (
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${getScoreColor(article.confidence_score)}`} title={article.confidence_notes || getScoreLabel(article.confidence_score)}>
                        {(() => { const Icon = getScoreIcon(article.confidence_score); return Icon ? <Icon className="size-3" /> : null; })()}
                        {article.confidence_score}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!semanticMode && articlesResult && articlesResult.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); updateURL({ page: String(p) }) }}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {articlesResult.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= articlesResult.total_pages}
            onClick={() => { const p = page + 1; setPage(p); updateURL({ page: String(p) }) }}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
