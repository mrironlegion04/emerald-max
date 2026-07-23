import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import EditProcedureClient from '@/components/EditProcedureClient'

export default async function EditProcedurePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) redirect('/dashboard')

  const { id } = await params
  const [procedure, assets, locations, assetCategories, teams] = await Promise.all([
    prisma.procedure.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { sortOrder: 'asc' } },
        locations: { select: { id: true } },
        categories: { select: { id: true } },
        assets: { select: { id: true } },
      },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.assetCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  if (!procedure) notFound()

  return (
    <EditProcedureClient
      procedureId={procedure.id}
      procedure={{
        name: procedure.name,
        description: procedure.description,
        teamId: procedure.teamId,
        steps: procedure.steps as any,
        assets: procedure.assets,
        categories: procedure.categories,
        locations: procedure.locations,
      }}
      assets={assets}
      locations={locations}
      assetCategories={assetCategories}
      teams={teams}
    />
  )
}
