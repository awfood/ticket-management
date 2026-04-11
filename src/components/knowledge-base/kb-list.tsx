'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  BookOpen,
  Tag,
  Calendar,
  Sparkles,
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
  { value: 'geral', label: 'Geral' },
  { value: 'integracao', label: 'Integracao' },
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'cardapio', label: 'Cardapio' },
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'configuracao', label: 'Configuracao' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
]

async function fetchArticles(
  search: string,
  category: string,
  published: string,
  page: number
): Promise<PaginatedResponse<KnowledgeBaseArticle>> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: '12',
  })
  if (search) params.set('search', search)
  if (category) params.set('category', category)
  if (published) params.set('published', published)

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
  if (!res.ok) throw new Error('Erro na busca semantica')
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
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [published, setPublished] = useState('')
  const [page, setPage] = useState(1)
  const [semanticMode, setSemanticMode] = useState(false)

  const {
    data: articlesResult,
    isLoading: articlesLoading,
  } = useQuery({
    queryKey: ['kb-articles', search, category, published, page],
    queryFn: () => fetchArticles(search, category, published, page),
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
    } else {
      setPage(1)
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
            Artigos e documentacao de suporte
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
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>

        <Button
          variant={semanticMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSemanticMode(!semanticMode)}
          title="Busca semantica com IA"
        >
          <Sparkles className="size-3.5" data-icon="inline-start" />
          Semantica
        </Button>

        <Select value={category} onValueChange={(v) => setCategory(v ?? '')}>
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
          <Select value={published} onValueChange={(v) => setPublished(v ?? '')}>
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

                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                    <Calendar className="size-2.5" />
                    {formatDate(article.updated_at)}
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
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} de {articlesResult.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= articlesResult.total_pages}
            onClick={() => setPage(page + 1)}
          >
            Proxima
          </Button>
        </div>
      )}
    </div>
  )
}
