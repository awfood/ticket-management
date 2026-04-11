import { createClient } from './server'
import type { UserContext, UserRole } from '@/types'

export async function getCurrentUser(): Promise<UserContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const { data: memberships } = await supabase
    .from('org_members')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const membershipList = memberships ?? []
  const internalMembership = membershipList.find(
    (m) => m.organization?.type === 'internal'
  )
  const currentOrg = internalMembership?.organization ?? membershipList[0]?.organization ?? null
  const role = (internalMembership?.role ?? membershipList[0]?.role ?? null) as UserRole | null

  // Load permissions for the role
  let permissions: string[] = []
  if (role) {
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permission:permissions(name)')
      .eq('role', role)

    permissions = (rolePerms ?? [])
      .map((rp: Record<string, unknown>) => {
        const perm = rp.permission as { name: string } | null
        return perm?.name
      })
      .filter((p): p is string => !!p)
  }

  return {
    profile,
    memberships: membershipList,
    currentOrg,
    isInternal: profile.is_internal,
    role,
    permissions,
  }
}

export function hasPermission(user: UserContext, permission: string): boolean {
  if (user.role === 'super_admin') return true
  return user.permissions.includes(permission)
}

export function isInternalRole(role: UserRole): boolean {
  return ['super_admin', 'admin', 'agent', 'viewer'].includes(role)
}
