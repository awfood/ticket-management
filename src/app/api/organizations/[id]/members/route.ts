import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!profile?.is_internal) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  const { data: members, error } = await supabase
    .from('org_members')
    .select('*, profile:profiles(*)')
    .eq('org_id', id)
    .order('is_active', { ascending: false })
    .order('joined_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(members ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  // Must be internal user or org_admin to add members
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  const isInternal = profile?.is_internal ?? false

  if (!isInternal) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', id)
      .eq('is_active', true)
      .single()

    if (!membership || membership.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem adicionar membros' },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  const { email, full_name, role } = body

  if (!email || !role) {
    return NextResponse.json(
      { error: 'Campos obrigatorios: email, role' },
      { status: 400 }
    )
  }

  // Verify org exists
  const { data: org } = await supabase
    .from('organizations')
    .select('id, type')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
  }

  // Check if user already exists by looking up auth users via service client
  const serviceClient = await createServiceClient()
  const { data: existingUsers } = await serviceClient.auth.admin.listUsers()

  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (existingUser) {
    // Check if already a member
    const { data: existingMember } = await supabase
      .from('org_members')
      .select('id, is_active')
      .eq('user_id', existingUser.id)
      .eq('org_id', id)
      .single()

    if (existingMember) {
      if (existingMember.is_active) {
        return NextResponse.json(
          { error: 'Usuario ja e membro desta organizacao' },
          { status: 409 }
        )
      }
      // Reactivate
      const { data: member, error } = await supabase
        .from('org_members')
        .update({ is_active: true, role, invited_by: user.id })
        .eq('id', existingMember.id)
        .select('*, profile:profiles(*)')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(member, { status: 200 })
    }

    // Add as new member
    const { data: member, error } = await supabase
      .from('org_members')
      .insert({
        user_id: existingUser.id,
        org_id: id,
        role,
        is_active: true,
        invited_by: user.id,
        joined_at: new Date().toISOString(),
      })
      .select('*, profile:profiles(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(member, { status: 201 })
  }

  // User does not exist: send invite via Supabase Auth
  const { data: inviteData, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name || email.split('@')[0],
        pending_org_id: id,
        pending_org_role: role,
      },
    })

  if (inviteError) {
    return NextResponse.json(
      { error: `Erro ao enviar convite: ${inviteError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      message: 'Convite enviado por email',
      invited_email: email,
      invite_id: inviteData.user?.id,
    },
    { status: 201 }
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const isInternal = profile?.is_internal ?? false

  if (!isInternal) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', id)
      .eq('is_active', true)
      .single()

    if (!membership || membership.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar roles' },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  const { member_id, role } = body

  if (!member_id || !role) {
    return NextResponse.json(
      { error: 'Campos obrigatorios: member_id, role' },
      { status: 400 }
    )
  }

  const { data: member, error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('id', member_id)
    .eq('org_id', id)
    .select('*, profile:profiles(*)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(member)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const isInternal = profile?.is_internal ?? false

  if (!isInternal) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', id)
      .eq('is_active', true)
      .single()

    if (!membership || membership.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem remover membros' },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  const { member_id } = body

  if (!member_id) {
    return NextResponse.json({ error: 'Campo obrigatorio: member_id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('org_members')
    .update({ is_active: false })
    .eq('id', member_id)
    .eq('org_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Membro removido com sucesso' })
}
