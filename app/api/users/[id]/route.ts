import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hashPassword } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  name:       z.string().min(1).optional(),
  email:      z.string().email().optional(),
  password:   z.string().min(6).optional(),
  role:       z.enum(['ADMIN','MANAGER','TECHNICIAN']).optional(),
  isActive:   z.boolean().optional(),
  phone:      z.string().nullable().optional(),
  bio:        z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  domainId:   z.string().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true, phone: true, bio: true, department: true, domainId: true },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json(user)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const body   = await request.json()
    const data   = updateSchema.parse(body)

    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase(), NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {
      name:       data.name,
      role:       data.role,
      isActive:   data.isActive,
      phone:      data.phone ?? null,
      bio:        data.bio ?? null,
      department: data.department ?? null,
      domainId:   data.domainId ?? null,
    }
    if (data.email)    updateData.email        = data.email.toLowerCase()
    if (data.password) updateData.passwordHash = await hashPassword(data.password)

    // Remove undefined keys
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k])

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id:true, name:true, email:true, role:true, isActive:true, phone:true, bio:true, department:true, domainId: true },
    })

    await writeAudit({
      action: 'UPDATE', entity: 'User',
      entityId: updated.id, entityName: updated.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
