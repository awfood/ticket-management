import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const publicPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/auth/callback',
]

function isPublicPath(pathname: string): boolean {
  // API v1 and webhooks handle their own auth (API keys)
  if (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/webhooks/')) {
    return true
  }
  return publicPaths.some((path) => pathname.startsWith(path))
}

function isAuthPage(pathname: string): boolean {
  return ['/login', '/register', '/forgot-password'].some((path) =>
    pathname.startsWith(path)
  )
}

function isProtectedApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
    && !pathname.startsWith('/api/webhooks/')
    && !pathname.startsWith('/api/v1/')
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session - important to call getUser() to refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect unauthenticated users to login for protected paths
  if (!user && !isPublicPath(pathname)) {
    // Protected API routes return 401 instead of redirect
    if (isProtectedApiPath(pathname)) {
      return NextResponse.json(
        { error: 'Nao autorizado' },
        { status: 401 }
      )
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
