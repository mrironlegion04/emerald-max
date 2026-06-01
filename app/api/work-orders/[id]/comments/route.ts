import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const comments = await prisma.workOrderComment.findMany({
      where:   { workOrderId: id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(comments)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { content } = commentSchema.parse(body)

    // Verify WO exists
    const wo = await prisma.workOrder.findUnique({ where: { id } })
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    const comment = await prisma.workOrderComment.create({
      data: {
        workOrderId: id,
        content,
        authorId:    user.userId,
        authorName:  user.name,
        authorRole:  user.role,
      },
    })

    // Bidirectional Mirror: Also create a ChatMessage so it instantly streams in messages view too
    try {
      await prisma.chatMessage.create({
        data: {
          content,
          channel: `WO_${id}`,
          channelName: `${wo.woNumber}: ${wo.title}`,
          senderId: user.userId,
          senderName: user.name,
          senderRole: user.role,
          workOrderId: id,
        },
      })
    } catch (err) {
      console.error('Failed to mirror work order comment to chat message room:', err)
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }
}