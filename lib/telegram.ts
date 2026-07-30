import { prisma } from '@/lib/db'
import crypto from 'crypto'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function apiCall(method: string, body?: Record<string, any>) {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return await res.json()
  } catch {
    return null
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  await apiCall('sendMessage', {
    chat_id: parseInt(chatId, 10),
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
}

export async function sendTelegramNotification(
  chatId: string,
  title: string,
  message: string,
  href?: string
) {
  const link = href ? `${BASE_URL}${href}` : BASE_URL
  const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}\n\n<a href="${link}">Open in Emerald Max</a>`
  await sendTelegramMessage(chatId, text)
}

export async function generatePairingToken(userId: string): Promise<{
  token: string
  expiresAt: Date
  deepLink: string
}> {
  // Expire any previous unused tokens for this user
  await prisma.telegramPairing.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  })

  const token = crypto.randomBytes(10).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.telegramPairing.create({
    data: { userId, token, expiresAt },
  })

  const botUsername = BOT_USERNAME || 'your_bot'
  const deepLink = `https://t.me/${botUsername}?start=${token}`

  return { token, expiresAt, deepLink }
}

export async function pollPairing(
  userId: string,
  offset?: number
): Promise<{ linked: boolean; maxUpdateId?: number; message?: string }> {
  if (!BOT_TOKEN) return { linked: false, message: 'TELEGRAM_BOT_TOKEN not set' }

  await apiCall('deleteWebhook')

  const data = await apiCall('getUpdates', {
    timeout: 5,
    limit: 50,
    allowed_updates: ['message'],
    ...(offset ? { offset } : {}),
  })

  if (!data?.ok) {
    console.error('getUpdates failed:', data)
    return { linked: false, message: 'Telegram API error' }
  }
  if (!data.result?.length) return { linked: false }

  let maxUpdateId = offset ?? 0

  for (const update of data.result) {
    if (update.update_id > maxUpdateId) maxUpdateId = update.update_id
    const msg = update.message
    if (!msg?.text) continue

    const chatId = String(msg.chat.id)
    const text = msg.text.trim()

    if (text === '/start' || text === '/help') {
      await sendTelegramMessage(
        chatId,
        `🔗 <b>Link your account</b>\n\n1. Go to Profile → Link Telegram in the CMMS\n2. Copy the pairing code\n3. Send it here as a message`
      )
      continue
    }

    let token = ''
    if (text.startsWith('/start ')) {
      token = text.slice(7).trim()
    } else if (/^[a-f0-9]{16,32}$/.test(text)) {
      token = text
    }

    if (!token) {
      await sendTelegramMessage(
        chatId,
        `🤖 <b>Emerald Max Bot</b>\n\nTo link your account, get a pairing code from <b>Profile → Link Telegram</b> in the CMMS, then send it here.`
      )
      continue
    }

    const error = await validatePairingToken(token, chatId)
    if (error === null) {
      const firstName = msg.from?.first_name || 'User'
      await sendTelegramMessage(
        chatId,
        `✅ <b>Hello, ${escapeHtml(firstName)}!</b>\n\nYour Telegram is now linked to Emerald Max. You'll receive notifications here.`
      )
      return { linked: true, maxUpdateId }
    }
  }

  return { linked: false, maxUpdateId }
}

export async function validatePairingToken(
  token: string,
  chatId: string
): Promise<string | null> {
  const pairing = await prisma.telegramPairing.findUnique({
    where: { token },
    include: { user: { select: { id: true, telegramChatId: true } } },
  })

  if (!pairing) return 'Invalid token'
  if (pairing.usedAt) return 'Token already used'
  if (pairing.expiresAt < new Date()) return 'Token expired'

  const existing = await prisma.user.findFirst({
    where: { telegramChatId: chatId, id: { not: pairing.userId } },
  })
  if (existing) return 'This Telegram account is already linked to another user'

  await prisma.$transaction([
    prisma.user.update({
      where: { id: pairing.userId },
      data: { telegramChatId: chatId },
    }),
    prisma.telegramPairing.update({
      where: { id: pairing.id },
      data: { usedAt: new Date() },
    }),
  ])

  return null
}

export async function unlinkTelegram(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { telegramChatId: null },
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
