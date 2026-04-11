import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/api-keys'

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

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, org_id, scopes, is_active, last_used_at, expires_at, created_at, organization:organizations(id, name, slug)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: keys })
}

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { name, org_id, scopes, expires_at } = body

  if (!name) {
    return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
  }

  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'Ao menos um scope obrigatorio' }, { status: 400 })
  }

  const validScopes = ['tickets.read', 'tickets.write', 'comments.write', 'orgs.read', 'orgs.write']
  const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s))
  if (invalidScopes.length > 0) {
    return NextResponse.json(
      { error: `Scopes invalidos: ${invalidScopes.join(', ')}` },
      { status: 400 }
    )
  }

  const { token, hash, prefix } = generateApiKey()

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .insert({
      name,
      key_hash: hash,
      key_prefix: prefix,
      org_id: org_id || null,
      scopes,
      expires_at: expires_at || null,
      created_by: user.id,
    })
    .select('id, name, key_prefix, org_id, scopes, is_active, expires_at, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return token ONCE — it won't be retrievable again
  return NextResponse.json(
    { data: { ...apiKey, token } },
    { status: 201 }
  )
}
