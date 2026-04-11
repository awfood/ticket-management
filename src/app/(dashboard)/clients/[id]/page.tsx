import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientDetailView } from '@/components/clients/client-detail'

export const metadata = {
  title: 'Detalhes do Cliente - AWFood Suporte',
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, type')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!org) {
    notFound()
  }

  return <ClientDetailView orgId={id} initialOrg={org} />
}
