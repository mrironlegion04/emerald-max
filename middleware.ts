import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'cmms_session',
  cookieOptions: {
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    partitioned: true,
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
  '/work-order-templates',
  '/preventive-maintenance',
  '/messages',
  '/asset-explorer',
  '/sites',
  '/import',
]

// Routes only REQUESTER can access
const REQUESTER_ONLY_PATHS = [
  '/my-requests',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/cron/') || pathname === '/request') {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = session.role

  // REQUESTER trying to access staff-only routes → redirect to their requests list
  if (role === 'REQUESTER') {
    const isStaffPath = STAFF_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (isStaffPath) {
      return NextResponse.redirect(new URL('/my-requests', request.url))
    }
  }

  // Non-REQUESTER trying to access requester-only routes → redirect to /work-orders
  if (role && role !== 'REQUESTER') {
    const isRequesterPath = REQUESTER_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (isRequesterPath) {
      return NextResponse.redirect(new URL('/work-orders', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
