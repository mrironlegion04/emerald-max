import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    // Only user themselves or admins can manage skills
    if (user?.userId !== id && user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { skillId, proficiencyLevel } = await req.json()

    if (!skillId) {
      return Response.json({ error: 'Skill ID is required' }, { status: 400 })
    }

    // Check if skill exists
    const skillExists = await prisma.skill.findUnique({ where: { id: skillId } })
    if (!skillExists) {
      return Response.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Check if user exists
    const userExists = await prisma.user.findUnique({ where: { id } })
    if (!userExists) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Create or update user skill
    const userSkill = await prisma.userSkill.upsert({
      where: {
        userId_skillId: {
          userId: id,
          skillId,
        },
      },
      update: {
        proficiencyLevel: proficiencyLevel || 'INTERMEDIATE',
      },
      create: {
        userId: id,
        skillId,
        proficiencyLevel: proficiencyLevel || 'INTERMEDIATE',
      },
      include: {
        skill: true,
      },
    })

    return Response.json(userSkill)
  } catch (error) {
    console.error('Error managing user skill:', error)
    return Response.json({ error: 'Failed to manage skill' }, { status: 500 })
  }
}
