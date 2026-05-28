import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notificationEmitter } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE data
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (e) {
          // Stream might be closed
        }
      }

      // Initial fetch
      try {
        const initialNotifications = await prisma.notification.findMany({
          where: { userId: user.userId, isRead: false },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        sendEvent(initialNotifications)
      } catch (err) {
        console.error('SSE Initial Fetch Error:', err)
      }

      // Fetch function to send latest notifications
      const fetchAndSend = async () => {
        try {
          const notifications = await prisma.notification.findMany({
            where: { userId: user.userId, isRead: false },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
          sendEvent(notifications)
        } catch (error) {
          console.error('SSE Fetch Error:', error)
        }
      }

      // Listen for real-time notification events
      const eventName = `notification:${user.userId}`
      notificationEmitter.on(eventName, fetchAndSend)

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        notificationEmitter.off(eventName, fetchAndSend)
        try {
          controller.close()
        } catch (e) {
          // ignore
        }
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
