import { createHash, randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export interface ApiKeyContext {
  keyId: string
  name: string
  orgId: string | null
  scopes: string[]
}

interface ApiKeyRow {
  id: string
  name: string
  org_id: string | null
  scopes: string[]
  is_active: boolean
  expires_at: string | null
  last_used_at: string | null
}

type ApiKeyResult =
  | { ok: true; context: ApiKeyContext }
  | { ok: false; response: NextResponse }

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateApiKey(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex')
  const token = `ak_${raw}`
  const hash = hashToken(token)
  const prefix = token.slice(0, 11) // "ak_" + first 8 hex chars
  return { token, hash, prefix }
}

function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status }
  )
}

export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyResult> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ak_')) {
    return {
      ok: false,
      response: errorResponse(
        'MISSING_API_KEY',
        'Header Authorization: Bearer ak_... obrigatorio',
        401
      ),
    }
  }

  const token = authHeader.slice(7) // Remove "Bearer "
  const hash = hashToken(token)

  const supabase = await createServiceClient()
  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, name, org_id, scopes, is_active, expires_at')
    .eq('key_hash', hash)
    .single<ApiKeyRow>()

  if (error || !apiKey) {
    return {
      ok: false,
      response: errorResponse('INVALID_API_KEY', 'API key invalida', 401),
    }
  }

  if (!apiKey.is_active) {
    return {
      ok: false,
      response: errorResponse('KEY_REVOKED', 'API key foi revogada', 401),
    }
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return {
      ok: false,
      response: errorResponse('KEY_EXPIRED', 'API key expirada', 401),
    }
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {})

  return {
    ok: true,
    context: {
      keyId: apiKey.id,
      name: apiKey.name,
      orgId: apiKey.org_id,
      scopes: apiKey.scopes,
    },
  }
}

export function requireScope(context: ApiKeyContext, scope: string): NextResponse | null {
  if (!context.scopes.includes(scope)) {
    return errorResponse(
      'INSUFFICIENT_SCOPE',
      `Scope '${scope}' necessario para esta operacao`,
      403
    )
  }
  return null
}

export function apiResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status })
}

export function apiError(code: string, message: string, status: number): NextResponse {
  return errorResponse(code, message, status)
}
