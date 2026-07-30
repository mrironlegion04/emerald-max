import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { generatePairingToken, unlinkTelegram } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { telegramChatId: true },
    })
    if (dbUser?.telegramChatId) {
      return NextResponse.json({
        linked: true,
        message: 'Telegram already linked. Unlink first to re-link.',
      })
    }

    const { token, deepLink, expiresAt } = await generatePairingToken(user.userId)

    return NextResponse.json({
      code: token,
      deepLink,
      expiresAt,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'emerald_maintenance_bot',
      message: 'Send this code to the bot on Telegram.',
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to generate pairing code' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await unlinkTelegram(user.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to unlink' }, { status: 500 })
  }
}
