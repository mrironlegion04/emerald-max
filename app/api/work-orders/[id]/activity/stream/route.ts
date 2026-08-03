import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canViewWorkOrder } from '@/lib/access-control'
import { notificationEmitter } from '@/lib/events'
import { buildActivityEvents, resolveActivityLookups } from '@/lib/work-order-activity'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const viewAccess = await canViewWorkOrder(user, id)
  if (!viewAccess.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Stream might be closed
        }
      }

      const buildPayload = async () => {
        const [statusHistory, auditLogs] = await Promise.all([
          prisma.workOrderStatusHistory.findMany({
            where: { workOrderId: id },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.auditLog.findMany({
            where: { entity: 'Work Order', entityId: id, action: { not: 'STATUS_CHANGE' } },
            orderBy: { createdAt: 'asc' },
          }),
        ])
        const { users, teams } = await resolveActivityLookups(auditLogs, prisma)
        return { events: buildActivityEvents(statusHistory, auditLogs, users, teams), currentUserId: user.userId }
      }

      // Initial fetch
      try {
        sendEvent(await buildPayload())
      } catch (err) {
        console.error('Activity SSE Initial Fetch Error:', err)
      }

      const fetchAndSend = async () => {
        try {
          sendEvent(await buildPayload())
        } catch (error) {
          console.error('Activity SSE Fetch Error:', error)
        }
      }

      const onActivity = () => fetchAndSend()

      notificationEmitter.on(`activity:${id}`, onActivity)

      req.signal.addEventListener('abort', () => {
        notificationEmitter.off(`activity:${id}`, onActivity)
        try {
          controller.close()
        } catch {
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
