import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { z } from 'zod'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, password } = loginSchema.parse(body)

    const normalized = identifier.toLowerCase()
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
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid username or email or password' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
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
    await session.save()

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}