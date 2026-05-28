import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { id } = await params
    await prisma.bOMTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { id } = await params
    const { name, description } = await request.json()
    
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const template = await prisma.bOMTemplate.update({
      where: { id },
      data: { name, description }
    })
    
    return NextResponse.json(template)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}
