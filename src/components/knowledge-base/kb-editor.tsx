'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { marked } from 'marked'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Save,
  ArrowLeft,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import dynamic from 'next/dynamic'
import { RichTextViewer } from '@/components/shared/rich-text-editor'

const RichTextEditor = dynamic(
  () => import('@/components/shared/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
  { loading: () => <div className="h-64 rounded-lg bg-muted animate-pulse" /> }
)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TagInput } from '@/components/shared/tag-input'
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
import type { KnowledgeBaseArticle } from '@/types'

const articleSchema = z.object({
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres'),
  content: z.string().min(10, 'O conteúdo deve ter pelo menos 10 caracteres'),
  content_html: z.string().nullable().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()),
  is_published: z.boolean(),
})

type ArticleFormData = z.infer<typeof articleSchema>

const CATEGORIES = [
  { value: 'geral', label: 'Primeiros Passos' },
  { value: 'cardapio', label: 'Cardápio e Produtos' },
  { value: 'integracao', label: 'Integrações' },
  { value: 'pdv', label: 'PDV e Vendas' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'fiscal', label: 'Fiscal (NFC-e / NF-e)' },
  { value: 'pagamento', label: 'Meios de Pagamento' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'cadastros', label: 'Cadastros' },
  { value: 'promocoes', label: 'Promoções' },
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'configuracao', label: 'Configurações' },
  { value: 'troubleshooting', label: 'Solução de Problemas' },
  { value: 'pedidos', label: 'Pedidos' },
]

interface KBEditorProps {
  article?: KnowledgeBaseArticle
}

export function KBEditor({ article }: KBEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [preview, setPreview] = useState(false)

  const isEditing = !!article

  // Se o artigo tem content mas não tem content_html, converte Markdown → HTML
  const initialHtml = useMemo(() => {
    if (article?.content_html) return article.content_html
    if (article?.content) {
      // Detecta se o conteúdo parece ser Markdown (tem headers, listas, bold, etc.)
      const md = article.content
      const looksLikeMarkdown = /^#{1,6}\s|^\*\s|^\-\s|^\d+\.\s|\*\*|__|\[.*\]\(.*\)|```/m.test(md)
      if (looksLikeMarkdown) {
        return marked.parse(md, { async: false }) as string
      }
    }
    return ''
  }, [article?.content, article?.content_html])

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema) as never,
    defaultValues: {
      title: article?.title ?? '',
      content: article?.content ?? '',
      content_html: article?.content_html ?? null,
      category: article?.category ?? '',
      tags: article?.tags ?? [],
      is_published: article?.is_published ?? false,
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form

  const watchContent = watch('content')
  const watchTitle = watch('title')
  const watchPublished = watch('is_published')
  const watchTags = watch('tags')
  const watchCategory = watch('category')

  const onSubmit = async (data: ArticleFormData) => {
    setSaving(true)
    try {
      const url = isEditing
        ? `/api/knowledge-base/${article.id}`
        : '/api/knowledge-base'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          content_html: data.content_html || null,
          category: data.category || null,
          tags: data.tags,
          is_published: data.is_published,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro ao salvar artigo')
      }

      const saved = await res.json()
      toast.success(
        isEditing ? 'Artigo atualizado com sucesso.' : 'Artigo criado e salvo.'
      )

      if (!isEditing) {
        router.push(`/knowledge-base/${saved.id}`)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao salvar artigo'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!article) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/knowledge-base/${article.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Não foi possível excluir o artigo. Verifique sua conexão e tente novamente.')
      }

      toast.success('Artigo excluído.')
      router.push('/knowledge-base')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível excluir o artigo.'
      toast.error(message)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

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
          <div>
            <h1 className="text-xl font-semibold">
              {isEditing ? 'Editar Artigo' : 'Novo Artigo'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreview(!preview)}
          >
            {preview ? (
              <EyeOff className="size-3.5" data-icon="inline-start" />
            ) : (
              <Eye className="size-3.5" data-icon="inline-start" />
            )}
            {preview ? 'Editar' : 'Visualizar'}
          </Button>

          {isEditing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2
                  className="size-3.5 animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Trash2
                  className="size-3.5"
                  data-icon="inline-start"
                />
              )}
              Excluir artigo
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
          >
            {saving ? (
              <Loader2
                className="size-3.5 animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <Save className="size-3.5" data-icon="inline-start" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main Editor */}
        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ex.: Como configurar integração com iFood"
              {...register('title')}
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-xs text-red-500">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Content */}
          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle>{watchTitle || '(sem título)'}</CardTitle>
              </CardHeader>
              <CardContent>
                {watch('content_html') ? (
                  <RichTextViewer content={watch('content_html') ?? null} />
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                    {watchContent || '(sem conteúdo)'}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <RichTextEditor
                content={initialHtml || article?.content || ''}
                onChange={(html, text) => {
                  setValue('content', text, { shouldValidate: true })
                  setValue('content_html', html)
                }}
                placeholder="Escreva o conteúdo do artigo..."
                minHeight="400px"
                className={errors.content ? 'border-red-500' : ''}
              />
              {errors.content && (
                <p className="text-xs text-red-500">
                  {errors.content.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish Toggle */}
          <Card size="sm">
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="published">Publicado</Label>
                <Switch
                  id="published"
                  checked={watchPublished}
                  onCheckedChange={(checked) =>
                    setValue('is_published', checked === true)
                  }
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {watchPublished
                  ? 'Visível para todos os usuários'
                  : 'Rascunho — visível apenas internamente'}
              </p>
            </CardContent>
          </Card>

          {/* Category */}
          <Card size="sm">
            <CardContent className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={watchCategory ?? ''}
                onValueChange={(v) => setValue('category', v ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card size="sm">
            <CardContent className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                value={watchTags}
                onChange={(tags) => setValue('tags', tags)}
                placeholder="Adicionar tag..."
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              O artigo <strong>&ldquo;{watchTitle}&rdquo;</strong> será excluído permanentemente e não poderá ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              Excluir artigo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
