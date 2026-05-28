import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendOverdueDigest } from '@/lib/email'

// This route is meant to be called by a cron job or manually.
// Protect with a secret token so it can't be called by anyone.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token      = process.env.CRON_SECRET ?? ''
    if (token && authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now      = new Date()
    const overdueWOs = await prisma.workOrder.findMany({
      where: { status: { in: ['OPEN','IN_PROGRESS'] }, dueDate: { lt: now } },
      include: {
        asset:      { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    if (overdueWOs.length === 0) {
      return NextResponse.json({ message: 'No overdue work orders — digest not sent' })
    }

    // Find all admins and managers to notify
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['ADMIN','MANAGER'] } },
      select: { name: true, email: true },
    })

    const items = overdueWOs.map(w => ({
      woNumber:   w.woNumber,
      title:      w.title,
      daysOverdue: w.dueDate
        ? Math.ceil((now.getTime() - new Date(w.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      assignedTo: w.assignedTo?.name ?? null,
    }))

    let sent = 0
    for (const mgr of managers) {
      try {
        await sendOverdueDigest({ toEmail: mgr.email, toName: mgr.name, overdueItems: items })
        sent++
      } catch (e) {
        console.error(`Failed to send digest to ${mgr.email}:`, e)
      }
    }

    return NextResponse.json({
      success: true,
      overdueCount: overdueWOs.length,
      notified: sent,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Digest failed' }, { status: 500 })
  }
}