'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Pencil,
  Tag,
  Calendar,
  User,
  BookOpen,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { KnowledgeBaseArticle } from '@/types'

interface KBViewerProps {
  article: KnowledgeBaseArticle
}

async function fetchRelated(
  articleId: string,
  title: string
): Promise<KnowledgeBaseArticle[]> {
  try {
    const res = await fetch('/api/knowledge-base/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: title }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const results: KnowledgeBaseArticle[] = data.results ?? []
    // Exclude current article
    return results.filter((a) => a.id !== articleId).slice(0, 4)
  } catch {
    return []
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function KBViewer({ article }: KBViewerProps) {
  const user = useUser()
  const router = useRouter()

  const { data: related, isLoading: relatedLoading } = useQuery({
    queryKey: ['kb-related', article.id],
    queryFn: () => fetchRelated(article.id, article.title),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/knowledge-base')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold line-clamp-1">
            {article.title}
          </h1>
        </div>
        {user.isInternal && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/knowledge-base/${article.id}`)
            }
          >
            <Pencil className="size-3.5" data-icon="inline-start" />
            Editar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main Content */}
        <Card>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {article.content_html ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: article.content_html,
                  }}
                />
              ) : (
                article.content
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta Info */}
          <Card size="sm">
            <CardContent className="space-y-3">
              {article.category && (
                <div className="flex items-center gap-2">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline">{article.category}</Badge>
                </div>
              )}

              {article.tags && article.tags.length > 0 && (
                <div className="flex items-start gap-2">
                  <Tag className="size-3.5 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {article.author && (
                <div className="flex items-center gap-2">
                  <User className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {article.author.full_name}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Atualizado em {formatDate(article.updated_at)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Related Articles */}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">
                Artigos Relacionados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relatedLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !related || related.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum artigo relacionado encontrado
                </p>
              ) : (
                <div className="space-y-1">
                  {related.map((r) => (
                    <a
                      key={r.id}
                      href={`/knowledge-base/${r.id}`}
                      className="block rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors line-clamp-2"
                    >
                      {r.title}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
