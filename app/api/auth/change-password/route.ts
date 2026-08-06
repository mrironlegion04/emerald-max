import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { z } from 'zod'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true, isActive: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
    })

    // Bump the live session so the (re)authenticated session stays valid with the new version.
    session.sessionVersion = (session.sessionVersion ?? 0) + 1
    await session.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
