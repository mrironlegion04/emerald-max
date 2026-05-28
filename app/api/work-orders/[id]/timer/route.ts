import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const timerActionSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'stop']),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { action } = timerActionSchema.parse(await request.json())

    const wo = await prisma.workOrder.findUnique({ where: { id } })
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    // Can only use timer on IN_PROGRESS work orders
    if (wo.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Timer can only be used on IN_PROGRESS work orders' },
        { status: 422 }
      )
    }

    const now = new Date()
    const updateData: Record<string, unknown> = {}

    switch (action) {
      case 'start':
        if (wo.isTimerActive) {
          return NextResponse.json(
            { error: 'Timer is already running' },
            { status: 422 }
          )
        }
        if (wo.timerStartedAt && wo.timerPausedAt) {
          // Resume from a pause
          const pausedSeconds = Math.floor(
            (now.getTime() - new Date(wo.timerPausedAt).getTime()) / 1000
          )
          updateData.timerElapsedSeconds = (wo.timerElapsedSeconds || 0) + pausedSeconds
          updateData.timerPausedAt = null
        } else if (!wo.timerStartedAt) {
          // First start
          updateData.timerStartedAt = now
          updateData.timerElapsedSeconds = 0
        }
        updateData.isTimerActive = true
        break

      case 'pause':
        if (!wo.isTimerActive) {
          return NextResponse.json(
            { error: 'Timer is not running' },
            { status: 422 }
          )
        }
        if (!wo.timerStartedAt) {
          return NextResponse.json(
            { error: 'Timer was not started' },
            { status: 422 }
          )
        }
        // Calculate elapsed time since last start or pause
        const lastActive = wo.timerPausedAt ? new Date(wo.timerPausedAt) : new Date(wo.timerStartedAt)
        const elapsedSinceLastActive = Math.floor(
          (now.getTime() - lastActive.getTime()) / 1000
        )
        updateData.timerElapsedSeconds = (wo.timerElapsedSeconds || 0) + elapsedSinceLastActive
        updateData.timerPausedAt = now
        updateData.isTimerActive = false
        break

      case 'resume':
        if (wo.isTimerActive) {
          return NextResponse.json(
            { error: 'Timer is already running' },
            { status: 422 }
          )
        }
        if (!wo.timerPausedAt) {
          return NextResponse.json(
            { error: 'Timer is not paused' },
            { status: 422 }
          )
        }
        updateData.timerPausedAt = null
        updateData.isTimerActive = true
        break

      case 'stop':
        if (!wo.timerStartedAt) {
          return NextResponse.json(
            { error: 'Timer was not started' },
            { status: 422 }
          )
        }
        // Calculate total elapsed time
        let totalElapsed = wo.timerElapsedSeconds || 0
        if (wo.isTimerActive) {
          const lastActive = wo.timerPausedAt ? new Date(wo.timerPausedAt) : new Date(wo.timerStartedAt)
          const elapsed = Math.floor((now.getTime() - lastActive.getTime()) / 1000)
          totalElapsed += elapsed
        }
        // Convert to hours (rounded to 2 decimals)
        const laborHours = Math.round((totalElapsed / 3600) * 100) / 100
        updateData.laborHours = laborHours
        updateData.timerStartedAt = null
        updateData.timerPausedAt = null
        updateData.timerElapsedSeconds = 0
        updateData.isTimerActive = false
        break
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update timer' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        id: true,
        timerStartedAt: true,
        timerPausedAt: true,
        timerElapsedSeconds: true,
        isTimerActive: true,
        laborHours: true,
      },
    })

    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    // Calculate current elapsed time if timer is running
    let currentElapsed = wo.timerElapsedSeconds
    if (wo.isTimerActive && wo.timerStartedAt) {
      const lastActive = wo.timerPausedAt ? new Date(wo.timerPausedAt) : new Date(wo.timerStartedAt)
      const elapsed = Math.floor((Date.now() - lastActive.getTime()) / 1000)
      currentElapsed = (wo.timerElapsedSeconds || 0) + elapsed
    }

    return NextResponse.json({
      ...wo,
      timerElapsedSeconds: currentElapsed,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch timer' }, { status: 500 })
  }
}
