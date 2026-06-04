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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  console.log('Middleware - Path:', pathname)
  console.log('Middleware - Cookies:', request.cookies.getAll().map(c => c.name).join(', '))
  
  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  console.log('Middleware - IsLoggedIn:', session.isLoggedIn)

  if (!session.isLoggedIn) {
    console.log('Middleware - Not logged in, redirecting to /login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}