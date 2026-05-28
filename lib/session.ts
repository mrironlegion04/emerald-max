import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from './db'

export interface SessionData {
  userId: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN'
  isLoggedIn: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'cmms_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
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
    const userExists = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!userExists) return null
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