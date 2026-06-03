import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import SkillsManager from '@/components/SkillsManager'

export default async function SkillsPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const skills = await prisma.skill.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { userSkills: true },
      },
    },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Skills & Competencies"
        subtitle="Manage the global skills catalog"
      />

      <SkillsManager initialSkills={skills} />
    </div>
  )
}
