import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1), description: z.string().min(1),
  location: z.string().optional(), requesterName: z.string().min(1),
  requesterEmail: z.string().email().optional().or(z.literal('')),
  requesterPhone: z.string().optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
})

export async function GET() {
  const requests = await prisma.maintenanceRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { workOrder: { select: { id: true, woNumber: true } } },
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json())
    const request = await prisma.maintenanceRequest.create({
      data: {
        title: data.title, description: data.description,
        location: data.location || null, requesterName: data.requesterName,
        requesterEmail: data.requesterEmail || null, requesterPhone: data.requesterPhone || null,
        priority: data.priority,
      },
    })

    const user = await getCurrentUser().catch(() => null)
    await writeAudit({
      action: 'CREATE',
      entity: 'Request',
      entityId: request.id,
      entityName: request.title,
      userId: user?.userId,
      userName: user?.name ?? request.requesterName,
      userEmail: user?.email ?? request.requesterEmail ?? undefined,
    })

    return NextResponse.json(request, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}