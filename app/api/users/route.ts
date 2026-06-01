import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hashPassword } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const createSchema = z.object({
  name:       z.string().min(1, 'Name is required'),
  email:      z.string().email('Invalid email'),
  password:   z.string().min(6, 'Password must be at least 6 characters'),
  role:       z.enum(['ADMIN','MANAGER','TECHNICIAN']).default('TECHNICIAN'),
  isActive:   z.boolean().default(true),
  phone:      z.string().nullable().optional(),
  bio:        z.string().nullable().optional(),
  department: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        phone: true,
        bio: true,
        department: true,
        lastActiveAt: true,
        _count: {
          select: {
            assignedWorkOrders: true,
            createdWorkOrders: true,
            skills: true,
          },
        },
      },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    const data = createSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await hashPassword(data.password)
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
        isActive: data.isActive,
        phone: data.phone || null,
        bio: data.bio || null,
        department: data.department || null,
      },
      select: { id:true, name:true, email:true, role:true, isActive:true, phone:true, bio:true, department:true },
    })

    await writeAudit({
      action: 'CREATE', entity: 'User',
      entityId: newUser.id, entityName: newUser.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
