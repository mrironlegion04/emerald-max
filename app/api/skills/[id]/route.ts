import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    // Check if any users have this skill
    const usersWithSkill = await prisma.userSkill.count({
      where: { skillId: id },
    })

    if (usersWithSkill > 0) {
      return Response.json(
        { error: 'Cannot delete: users have this skill assigned' },
        { status: 409 }
      )
    }

    await prisma.skill.delete({
      where: { id },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting skill:', error)
    return Response.json({ error: 'Failed to delete skill' }, { status: 500 })
  }
}
