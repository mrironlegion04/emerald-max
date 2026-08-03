import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canViewWorkOrder } from '@/lib/access-control'
import { notifyMentionedUsers } from '@/lib/comment-mentions'
import { notificationEmitter } from '@/lib/events'
import { z } from 'zod'

const editSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
})

async function loadComment(commentId: string, woId: string) {
  return prisma.workOrderComment.findFirst({
    where: { id: commentId, workOrderId: woId },
    include: { attachments: { include: { uploadedBy: { select: { name: true } } } } },
  })
}

export async function PATCH(
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

    const comment = await loadComment(commentId, id)
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    if (comment.authorId !== user.userId) {
      return NextResponse.json({ error: 'Only the author can edit this comment' }, { status: 403 })
    }

    const body = await request.json()
    const { content } = editSchema.parse(body)

    const updated = await prisma.workOrderComment.update({
      where: { id: commentId },
      data: { content },
    })

    const wo = await prisma.workOrder.findUnique({ where: { id }, select: { woNumber: true } })
    if (wo) {
      await notifyMentionedUsers({
        content,
        workOrderId: id,
        woNumber: wo.woNumber,
        userId: user.userId,
        userName: user.name,
      })
    }

    notificationEmitter.emit(`comment:${id}`)

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to edit comment' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
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

    const comment = await loadComment(commentId, id)
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

    const isStaff = user.role === 'ADMIN' || user.role === 'MANAGER'
    if (comment.authorId !== user.userId && !isStaff) {
      return NextResponse.json({ error: 'Only the author or a manager can delete this comment' }, { status: 403 })
    }

    await prisma.workOrderComment.delete({ where: { id: commentId } })
    notificationEmitter.emit(`comment:${id}`)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
