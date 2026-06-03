export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderForm from '@/components/WorkOrderForm'

export default async function EditWorkOrderPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect(`/work-orders/${id}`)

  const [wo, assets, locations, users, teams, procedures] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id },
      include: { assets: { select: { assetId: true } } },
    }),
    prisma.asset.findMany({
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select:  { id: true, name: true, assetCode: true, imageUrl: true, categoryId: true, parentId: true, locationId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select:  { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where:   { isDeleted: false },
      select:  { id: true, name: true, trade: true },
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
  ])

  if (!wo) notFound()

  const selectedAssetIds = wo.assets.map((a: any) => a.assetId)

  const initialData = {
    title:           wo.title,
    description:     wo.description   ?? '',
    type:            wo.type,
    priority:        wo.priority,
    status:          wo.status,
    dueDate:         wo.dueDate ? new Date(wo.dueDate).toISOString().split('T')[0] : '',
    assetId:         wo.assetId       ?? '',
    locationId:      wo.locationId    ?? '',
    locationScope:   wo.locationScope ?? 'ALL_ASSETS',
    selectedAssetIds,
    assignedToId:    wo.assignedToId  ?? '',
    assignedTeamId:  wo.teamId        ?? '',
    laborHours:      wo.laborHours    != null ? String(wo.laborHours) : '',
    laborCost:       wo.laborCost     != null ? String(wo.laborCost)  : '',
    partsCost:       wo.partsCost     != null ? String(wo.partsCost)  : '',
    notes:           wo.notes         ?? '',
    issueId:         wo.issueId       ?? '',
    customIssue:     wo.customIssue   ?? '',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/work-orders/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to work order
        </Link>
      </div>
      <PageHeader title={`Edit: ${wo.title}`} subtitle={wo.woNumber} />
      <WorkOrderForm assets={assets} locations={locations} users={users} teams={teams} procedures={procedures} initialData={initialData} woId={id} />
    </div>
  )
}
