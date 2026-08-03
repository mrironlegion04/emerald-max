import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canViewWorkOrder } from '@/lib/access-control'
import { notificationEmitter } from '@/lib/events'
import { z } from 'zod'

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'] as const

const reactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, commentId } = await params
    const viewAccess = await canViewWorkOrder(user, id)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const comment = await prisma.workOrderComment.findFirst({
      where: { id: commentId, workOrderId: id },
      select: { id: true },
    })
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

    const body = await request.json()
    const { emoji } = reactionSchema.parse(body)

    const existing = await prisma.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId: user.userId, emoji } },
    })

    if (existing) {
      await prisma.commentReaction.delete({ where: { id: existing.id } })
    } else {
      await prisma.commentReaction.create({
        data: { commentId, userId: user.userId, emoji },
      })
    }

    notificationEmitter.emit(`comment:${id}`)

    const reactions = await prisma.commentReaction.findMany({ where: { commentId } })
    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
      if (r.userId === user.userId) mine.add(r.emoji)
    }

    return NextResponse.json({
      emoji,
      reactedByMe: !existing,
      reactions: Object.entries(counts).map(([emoji, count]) => ({
        emoji,
        count,
        reactedByMe: mine.has(emoji),
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update reaction' }, { status: 500 })
  }
}
