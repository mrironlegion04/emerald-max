import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { getSessionSecret } from './env'

export interface SessionData {
  userId: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'REQUESTER' | 'VIEWER'
  isLoggedIn: boolean
  sessionVersion: number
}

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

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session.isLoggedIn) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, isActive: true, role: true, sessionVersion: true },
    })
    if (!user || !user.isActive || user.role !== session.role ||
        (session.sessionVersion ?? 0) !== user.sessionVersion) {
      // Deactivated, deleted, role changed, or password changed since login — invalidate.
      session.destroy()
      await session.save()
      return null
    }
  } catch (err) {
    console.error('Session validation error:', err)
    return null
  }

  return {
    userId: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
  }
}
