import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!profile?.is_internal) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  // Get all permissions
  const { data: permissions, error: permError } = await supabase
    .from('permissions')
    .select('*')
    .order('category')
    .order('name')

  if (permError) {
    return NextResponse.json({ error: permError.message }, { status: 500 })
  }

  // Get all role_permissions
  const { data: rolePerms, error: rpError } = await supabase
    .from('role_permissions')
    .select('*')

  if (rpError) {
    return NextResponse.json({ error: rpError.message }, { status: 500 })
  }

  return NextResponse.json({
    permissions: permissions ?? [],
    role_permissions: rolePerms ?? [],
  })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  // Only super_admin can modify permissions
  const { data: membership } = await supabase
    .from('org_members')
    .select('role, organization:organizations(type)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const internalMembership = (membership ?? []).find(
    (m: Record<string, unknown>) => {
      const org = m.organization as { type: string } | null
      return org?.type === 'internal'
    }
  )

  if (!internalMembership || internalMembership.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Apenas super_admin pode alterar permissoes' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { role, permission_id, enabled } = body

  if (!role || !permission_id || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Campos obrigatorios: role, permission_id, enabled' },
      { status: 400 }
    )
  }

  if (enabled) {
    // Upsert: add permission
    const { error } = await supabase
      .from('role_permissions')
      .upsert(
        { role, permission_id },
        { onConflict: 'role,permission_id' }
      )

    if (error) {
      // If upsert fails (no unique constraint), try insert
      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert({ role, permission_id })

      if (insertError && !insertError.message.includes('duplicate')) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }
  } else {
    // Remove permission
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role', role)
      .eq('permission_id', permission_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ message: 'Permissao atualizada' })
}
