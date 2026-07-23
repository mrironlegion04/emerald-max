import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import ProceduresManager from '@/components/ProceduresManager'

export default async function ProceduresPage() {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) redirect('/dashboard')

  const procedures = await prisma.procedure.findMany({
    include: {
      steps: true,
      team: { select: { id: true, name: true } },
      locations: true,
      categories: true,
      assets: true,
      _count: { select: { pmSchedules: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Procedure Library"
        subtitle={`${procedures.length} procedures · Create and manage reusable step-by-step SOPs for your team.`}
      />
      <ProceduresManager initialProcedures={procedures} />
    </div>
  )
}
