import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth-helpers'
import { KBEditor } from '@/components/knowledge-base/kb-editor'
import { KBViewer } from '@/components/knowledge-base/kb-viewer'

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: article, error } = await supabase
    .from('knowledge_base_articles')
    .select(
      '*, author:profiles!knowledge_base_articles_created_by_fkey(id, full_name, avatar_url)'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !article) {
    notFound()
  }

  const user = await getCurrentUser()

  if (!user) {
    notFound()
  }

  // Non-internal users can only see published articles
  if (!user.isInternal && !article.is_published) {
    notFound()
  }

  // Internal users get the editor, external users get the viewer
  if (user.isInternal) {
    return <KBEditor article={article} />
  }

  return <KBViewer article={article} />
}
