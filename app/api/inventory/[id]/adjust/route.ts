import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { createNotificationForUsers } from '@/lib/notifications'
import { z } from 'zod'

const adjustSchema = z.object({
  type:   z.enum(['add', 'remove', 'set']),
  amount: z.number().int().min(0),
  reason: z.string().optional(),
})

export async function POST() {
  return NextResponse.json(
    { error: 'Stock quantity tracking is disabled in this system.' },
    { status: 400 }
  )
}
