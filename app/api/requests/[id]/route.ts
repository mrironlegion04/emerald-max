import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { sendRequestApproved, sendRequestRejected, sendRequestConverted } from '@/lib/email'

async function generateWONumber() {
  const last = await prisma.workOrder.findFirst({ orderBy: { woNumber: 'desc' }, select: { woNumber: true } })
  let next = 1
  if (last?.woNumber) { const n = parseInt(last.woNumber.replace('WO-',''),10); if (!isNaN(n)) next = n+1 }
  return `WO-${String(next).padStart(4,'0')}`
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const { action, reason } = await req.json()

  const request = await prisma.maintenanceRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'PENDING') return NextResponse.json({ error: 'Request already reviewed' }, { status: 422 })

  if (action === 'approve') {
    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: user.userId },
    })
    // Send email to requester
    if (request.requesterEmail) {
      await sendRequestApproved({
        toEmail: request.requesterEmail,
        toName: request.requesterName || 'Requester',
        requestId: id,
        requestTitle: request.title,
        approvedBy: user.name,
      }).catch(console.error)
    }
    await writeAudit({
      action: 'UPDATE',
      entity: 'Request',
      entityId: updated.id,
      entityName: updated.title,
      changes: {
        status: { before: 'PENDING', after: 'APPROVED' }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })
    return NextResponse.json(updated)
  }

  if (action === 'reject') {
    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason ?? null, reviewedById: user.userId },
    })
    // Send email to requester
    if (request.requesterEmail) {
      await sendRequestRejected({
        toEmail: request.requesterEmail,
        toName: request.requesterName || 'Requester',
        requestId: id,
        requestTitle: request.title,
        rejectionReason: reason,
        rejectedBy: user.name,
      }).catch(console.error)
    }
    await writeAudit({
      action: 'UPDATE',
      entity: 'Request',
      entityId: updated.id,
      entityName: updated.title,
      changes: {
        status: { before: 'PENDING', after: 'REJECTED' },
        rejectionReason: { before: null, after: reason }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })
    return NextResponse.json(updated)
  }

  if (action === 'convert') {
    const woNumber = await generateWONumber()
    const [wo, updated] = await prisma.$transaction([
      prisma.workOrder.create({
        data: {
          woNumber, title: request.title, description: request.description,
          type: 'BREAKDOWN', status: 'OPEN', priority: request.priority as never,
          createdById: user.userId,
        },
      }),
      prisma.maintenanceRequest.update({
        where: { id },
        data: { status: 'CONVERTED', reviewedById: user.userId },
      }),
    ])
    // Link WO to request
    await prisma.maintenanceRequest.update({ where: { id }, data: { workOrderId: wo.id } })
    
    // Send email to requester
    if (request.requesterEmail) {
      await sendRequestConverted({
        toEmail: request.requesterEmail,
        toName: request.requesterName || 'Requester',
        requestId: id,
        requestTitle: request.title,
        woNumber: wo.woNumber,
        woId: wo.id,
        convertedBy: user.name,
      }).catch(console.error)
    }
    
    await writeAudit({
      action: 'UPDATE',
      entity: 'Request',
      entityId: updated.id,
      entityName: updated.title,
      changes: {
        status: { before: 'PENDING', after: 'CONVERTED' },
        workOrder: { before: null, after: wo.woNumber }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })
    
    return NextResponse.json({ ...updated, workOrderId: wo.id, woNumber: wo.woNumber })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}