import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { createNotificationForUsers } from '@/lib/notifications'
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

    if (['CLOSED', 'CANCELLED'].includes(wo.status)) {
      return NextResponse.json({ error: 'Cannot comment on a closed or cancelled work order' }, { status: 403 })
    }

    const comment = await prisma.workOrderComment.create({
      data: {
        workOrderId: id,
        content,
        authorId:    user.userId,
        authorName:  user.name,
        authorRole:  user.role,
      },
    })

    // Parse @mentions and notify mentioned users
    const mentionMatches = content.match(/@(\w+)/g)
    if (mentionMatches && mentionMatches.length > 0) {
      const mentionedNames = [...new Set(
        mentionMatches.map(m => m.slice(1).toLowerCase())
      )]

      const mentionedUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: user.userId },
          name: { contains: mentionedNames.join(' OR '), mode: 'insensitive' },
        },
        select: { id: true, name: true },
      })

      // More precise matching: check each name individually
      const matchedUserIds: string[] = []
      for (const uname of mentionedNames) {
        const found = mentionedUsers.find(u =>
          u.name.replace(/\s+/g, '').toLowerCase() === uname
        )
        if (found) matchedUserIds.push(found.id)
      }

      if (matchedUserIds.length > 0) {
        await createNotificationForUsers(
          matchedUserIds,
          {
            type: 'CHAT',
            title: `${user.name} mentioned you in ${wo.woNumber}`,
            message: content.slice(0, 100),
            href: `/work-orders/${id}`,
          },
        )
      }
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