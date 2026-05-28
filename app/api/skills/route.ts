import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
    })
    return Response.json(skills)
  } catch (error) {
    console.error('Error fetching skills:', error)
    return Response.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { name, category } = await req.json()

    if (!name?.trim()) {
      return Response.json({ error: 'Skill name is required' }, { status: 400 })
    }

    const skill = await prisma.skill.upsert({
      where: { name },
      update: { category },
      create: { name, category },
    })

    return Response.json(skill)
  } catch (error) {
    console.error('Error creating skill:', error)
    return Response.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}
