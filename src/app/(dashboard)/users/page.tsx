import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth-helpers'
import { UsersListClient } from '@/components/clients/users-list'

export const metadata = {
  title: 'Usuarios - AWFood Suporte',
}

export default async function UsersPage() {
  const user = await getCurrentUser()

  if (!user || !user.isInternal) {
    redirect('/dashboard')
  }

  return <UsersListClient />
}
