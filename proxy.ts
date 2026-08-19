import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'
import { getSessionSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const sessionOptions = {
  password: getSessionSecret(),
  cookieName: 'cmms_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

// Routes that only non-REQUESTER roles can access
const STAFF_ONLY_PATHS = [
  '/assets',
  '/overview',
  '/more',
  '/dashboard',
  '/calendar',
  '/schedule',
  '/to-do',
  '/settings',
  '/teams',
  '/parts',
  '/meters',
  '/procedures',
  '/reports',
  '/audit',
  '/domains',
  '/issues',
  '/skills',
  '/inventory',
  '/preventive-maintenance',
  '/messages',
  '/asset-explorer',
  '/sites',
  '/import',
]

// Routes only REQUESTER can access
const REQUESTER_ONLY_PATHS = [
  '/my-work-orders',
]

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const PUBLIC_MUTATING_PREFIXES = ['/api/cron/']

export async function proxy(request: NextRequest) {
  const startedAt = performance.now()
  const response = await handleRequest(request)
  logger.info('http_request', {
    method: request.method,
    path: request.nextUrl.pathname,
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
  })
  return response
}

async function handleRequest(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/health') ||
    pathname === '/request'
  ) {
    // /request is the only public page; it is no longer reachable anonymously
    // (see below), so unauthenticated visitors land here only when logged in.
    if (pathname === '/request' && !request.cookies.get('cmms_session')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return csrfCheck(request, pathname) ?? NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  if (!session.isLoggedIn) {
    // API consumers get JSON, page navigation gets a redirect.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = session.role

  // REQUESTER trying to access staff-only routes → redirect to their work orders
  if (role === 'REQUESTER') {
    const isStaffPath = STAFF_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (isStaffPath) {
      return NextResponse.redirect(new URL('/my-work-orders', request.url))
    }
  }

  // Non-REQUESTER trying to access requester-only routes → redirect to /work-orders
  if (role && role !== 'REQUESTER') {
    const isRequesterPath = REQUESTER_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (isRequesterPath) {
      return NextResponse.redirect(new URL('/work-orders', request.url))
    }
  }

  const csrf = csrfCheck(request, pathname)
  if (csrf) return csrf

  return response
}

// Defense-in-depth against CSRF. The session cookie is SameSite=Lax, which blocks
// cross-site requests from carrying the cookie in the classic vectors. On top of
// that, state-changing requests that DO include an Origin/Referer header must come
// from a host we trust. Requests with no Origin (curl, cron, non-browser clients)
// are passed through to the route handlers.
//
// Behind a reverse proxy the Host header the container sees can differ from the
// public hostname in the browser (nginx may forward Host: max:3000 by default).
// Compare the Origin against the trusted hosts: the immediate request host, the
// X-Forwarded-Host the edge proxy announces, the app's declared base URL, and any
// explicit TRUSTED_ORIGINS entries.
function trustedOriginHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>()

  const self = request.nextUrl.host
  if (self) hosts.add(self.toLowerCase())

  for (const raw of (request.headers.get('x-forwarded-host') ?? '').split(',')) {
    const host = raw.trim().toLowerCase()
    if (host) hosts.add(host)
  }

  for (const raw of (process.env.TRUSTED_ORIGINS ?? '').split(',')) {
    const value = raw.trim()
    if (!value) continue
    try {
      hosts.add(new URL(value).host.toLowerCase())
    } catch {
      hosts.add(value.toLowerCase())
    }
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL
  if (base) {
    try {
      hosts.add(new URL(base).host.toLowerCase())
    } catch {
      /* ignore malformed base URL */
    }
  }

  return hosts
}

function csrfCheck(request: NextRequest, pathname: string) {
  if (!MUTATING_METHODS.has(request.method)) return null
  if (PUBLIC_MUTATING_PREFIXES.some(p => pathname.startsWith(p))) return null

  const header = request.headers.get('origin') ?? request.headers.get('referer')
  if (!header) return null

  let headerHost: string | null = null
  try {
    headerHost = new URL(header).host.toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!trustedOriginHosts(request).has(headerHost)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export const config = {
  // Proxy runs before static files are served, so it cannot see the real
  // status of static responses (it would log false 200s for 404s). Exclude
  // static asset extensions so the access log only covers app/API routes.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|mjs|woff2?|ttf|eot|map|webmanifest|txt)$).*)',
  ],
}
