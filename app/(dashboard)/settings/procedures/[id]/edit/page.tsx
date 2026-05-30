import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import ProcedureForm from '@/components/ProcedureForm'

export default async function EditProcedurePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) redirect('/dashboard')

  const { id } = await params
  const [procedure, assets, locations, assetCategories] = await Promise.all([
    prisma.procedure.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories: true,
        assets: true,
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
  ])
  if (!procedure) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/settings/procedures" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to Procedures
        </Link>
      </div>
      <PageHeader
        title={`Edit: ${procedure.name}`}
        subtitle="Update the procedure name, steps, and target tags or resources."
      />
      <ProcedureForm
        templateId={procedure.id}
        initialData={{
          name:       procedure.name,
          description:procedure.description ?? '',
          steps:      procedure.steps.map((s: any) => ({
            id:          s.id,
            label:       s.label,
            type:        s.type,
            isMandatory: s.isMandatory,
            options:     s.options,
            sortOrder:   s.sortOrder,
          })),
          assetIds:    procedure.assets.map((a: any) => a.id),
          categoryIds: procedure.categories.map((c: any) => c.id),
          locationIds: procedure.locations.map((l: any) => l.id),
        }}
        assets={assets}
        locations={locations}
        assetCategories={assetCategories}
      />
    </div>
  )
}
