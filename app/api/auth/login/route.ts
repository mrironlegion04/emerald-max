import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPasswordTimingSafe } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { checkRateLimit, resetRateLimit, clientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_ATTEMPTS_PER_KEY = 5
const LOGIN_ATTEMPTS_PER_IP = 20

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, password } = loginSchema.parse(body)

    const normalized = identifier.toLowerCase()
    const ip = clientIp(request)

    // Per-account + per-IP throttling. The account key also includes the IP so
    // one user behind a shared NAT does not lock everyone else out of a target.
    const accountKey = `login:${normalized}:${ip}`
    const ipKey = `login:ip:${ip}`

    const acctLimit = checkRateLimit(accountKey, LOGIN_ATTEMPTS_PER_KEY, LOGIN_WINDOW_MS)
    if (!acctLimit.ok) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(acctLimit.retryAfterSeconds) } }
      )
    }
    const ipLimit = checkRateLimit(ipKey, LOGIN_ATTEMPTS_PER_IP, LOGIN_WINDOW_MS)
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { username: normalized },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        sessionVersion: true,
      },
    })

    // Timing-safe: unknown/inactive users still burn a bcrypt compare.
    const valid = await verifyPasswordTimingSafe(password, user?.passwordHash ?? '')
    if (!user || !user.isActive || !valid) {
      return NextResponse.json(
        { error: 'Invalid username or email or password' },
        { status: 401 }
      )
    }

    const session = await getSession()
    session.userId = user.id
    session.name = user.name
    session.email = user.email
    session.role = user.role
    session.isLoggedIn = true
    session.sessionVersion = user.sessionVersion
    await session.save()

    // Fresh start: clear any earlier failed-attempt buckets for this user/IP.
    resetRateLimit(accountKey)
    resetRateLimit(ipKey)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
