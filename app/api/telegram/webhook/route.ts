import { NextRequest, NextResponse } from 'next/server'
import { validatePairingToken, sendTelegramMessage } from '@/lib/telegram'

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
    from?: { id: number; first_name?: string; username?: string }
  }
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()

    const msg = update.message
    if (!msg?.text) return NextResponse.json({ ok: true })

    const chatId = String(msg.chat.id)
    const text = msg.text.trim()

    // Handle /start <token>
    if (text.startsWith('/start ')) {
      const token = text.slice(7).trim()
      const error = await validatePairingToken(token, chatId)

      if (error) {
        await sendTelegramMessage(chatId, `❌ ${error}`)
      } else {
        const firstName = msg.from?.first_name || 'User'
        await sendTelegramMessage(
          chatId,
          `✅ <b>Hello, ${escapeHtml(firstName)}!</b>\n\nYour Telegram is now linked to Emerald Max. You'll receive notifications here.`
        )
      }
    } else if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        'Welcome to Emerald Max!\n\nTo link your account, go to your Max profile, click "Link Telegram", and check your email for a link.'
      )
    } else if (text === '/help') {
      await sendTelegramMessage(
        chatId,
        'Available commands:\n/start — Welcome message\n/help — Show this help\n/unlink — Unlink from Max'
      )
    } else if (text === '/unlink') {
      await sendTelegramMessage(
        chatId,
        'To unlink, go to your Max profile settings and use the Telegram section there.'
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
