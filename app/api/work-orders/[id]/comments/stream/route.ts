import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canViewWorkOrder } from '@/lib/access-control'
import { notificationEmitter } from '@/lib/events'

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
        const comments = await prisma.workOrderComment.findMany({
          where: { workOrderId: id },
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: { include: { uploadedBy: { select: { name: true } } } },
          },
        })

        const commentIds = comments.map(c => c.id)
        const reactions = commentIds.length
          ? await prisma.commentReaction.findMany({ where: { commentId: { in: commentIds } } })
          : []

        const enriched = comments.map(c => {
          const counts: Record<string, number> = {}
          const mine = new Set<string>()
          for (const r of reactions) {
            if (r.commentId !== c.id) continue
            counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
            if (r.userId === user.userId) mine.add(r.emoji)
          }
          return {
            ...c,
            isEdited: new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000,
            reactions: Object.entries(counts).map(([emoji, count]) => ({
              emoji,
              count,
              reactedByMe: mine.has(emoji),
            })),
          }
        })

        return { comments: enriched, currentUserId: user.userId, currentUserRole: user.role }
      }

      // Initial fetch
      try {
        sendEvent(await buildPayload())
      } catch (err) {
        console.error('SSE Initial Fetch Error:', err)
      }

      const fetchAndSend = async () => {
        try {
          sendEvent(await buildPayload())
        } catch (error) {
          console.error('SSE Fetch Error:', error)
        }
      }

      const onComment = () => fetchAndSend()

      notificationEmitter.on(`comment:${id}`, onComment)

      req.signal.addEventListener('abort', () => {
        notificationEmitter.off(`comment:${id}`, onComment)
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
