import { prisma } from '@/lib/db'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderForm from '@/components/WorkOrderForm'

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string; templateId?: string }>
}) {
  const { assetId, templateId } = await searchParams

  const [assets, locations, users, teams, procedures, template] = await Promise.all([
    prisma.asset.findMany({
      where: { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select: { id: true, name: true, assetCode: true, imageUrl: true, categoryId: true, parentId: true, locationId: true, domainId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.procedure.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        steps: {
          select: {
            id: true,
            label: true,
            type: true,
            isMandatory: true,
            options: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        locations: { select: { id: true } },
        categories: { select: { id: true } },
        assets: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    }),
    templateId ? prisma.workOrderTemplate.findUnique({
      where: { id: templateId },
      include: {
        assignedTo: { select: { id: true } },
        team:       { select: { id: true } },
        category:   { select: { id: true } },
        procedures: {
          include: { procedure: { select: { id: true } } },
        },
      },
    }) : Promise.resolve(null),
  ])

  const templateInitialData = template ? {
    title:       template.name,
    description: template.woDescription ?? '',
    type:        template.woType,
    priority:    template.priority,
    assignedToId: template.assignedTo?.id ?? '',
    teamId:      template.team?.id ?? '',
    procedureIds: template.procedures.map(tp => tp.procedure.id),
  } : undefined

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/work-orders" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to work orders
        </Link>
      </div>
      <PageHeader
        title={template ? `New work order from "${template.name}"` : 'New work order'}
        subtitle={template ? 'Template fields pre-filled. Adjust as needed.' : 'Fill in the details to create a new work order.'}
      />
      <WorkOrderForm assets={assets} locations={locations} users={users} teams={teams} procedures={procedures} preselectedAssetId={assetId} initialData={templateInitialData} />
    </div>
  )
}
