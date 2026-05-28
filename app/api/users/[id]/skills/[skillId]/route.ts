import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const { id, skillId } = await params
    const user = await getCurrentUser()

    // Only user themselves or admins can manage skills
    if (user?.userId !== id && user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.userSkill.delete({
      where: {
        userId_skillId: {
          userId: id,
          skillId,
        },
      },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting user skill:', error)
    return Response.json({ error: 'Failed to remove skill' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const { id, skillId } = await params
    const user = await getCurrentUser()

    // Only user themselves or admins can manage skills
    if (user?.userId !== id && user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { proficiencyLevel } = await req.json()

    const userSkill = await prisma.userSkill.update({
      where: {
        userId_skillId: {
          userId: id,
          skillId,
        },
      },
      data: {
        proficiencyLevel,
      },
      include: {
        skill: true,
      },
    })

    return Response.json(userSkill)
  } catch (error) {
    console.error('Error updating user skill:', error)
    return Response.json({ error: 'Failed to update skill' }, { status: 500 })
  }
}
