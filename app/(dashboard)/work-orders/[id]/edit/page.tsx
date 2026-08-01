import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPickerScope, getWriteScopeIds, canEditWorkOrder } from '@/lib/access-control'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderForm from '@/components/WorkOrderForm'

export default async function EditWorkOrderPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN' || user?.role === 'REQUESTER') redirect(`/work-orders/${id}`)

  const scopeIds = user ? await getWriteScopeIds(user) : null
  const { assetFilter, userFilter } = user
    ? await getPickerScope(user.userId, scopeIds)
    : { assetFilter: null, userFilter: null }

  const scopeUserIds = scopeIds
    ? (await prisma.user.findMany({
        where: { userLocations: { some: { locationId: { in: scopeIds } } } },
        select: { id: true },
      })).map(u => u.id)
    : null

  const [wo, assets, locations, users, teams] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        assets: { select: { assetId: true } },
        repairSessions: {
          orderBy: { sessionNo: 'asc' },
          include: {
            startedBy: { select: { name: true } },
            completedBy: { select: { name: true } },
          },
        },
      },
    }),
    prisma.asset.findMany({
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' }, ...(assetFilter ?? {}) },
      select:  { id: true, name: true, assetCode: true, imageUrl: true, categoryId: true, parentId: true, locationId: true, domainId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      where:   scopeIds ? { id: { in: scopeIds } } : {},
      select:  { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where:   { isActive: true, ...(userFilter ?? {}) },
      select:  { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where:   { isActive: true, ...(scopeUserIds ? { members: { some: { userId: { in: scopeUserIds } } } } : {}) },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!wo) notFound()
  if (wo.status === 'CLOSED') redirect(`/work-orders/${id}`)

  // Plant isolation: only editors of THIS work order may reach the edit form
  if (user && !(await canEditWorkOrder(user, wo.id)).allowed) redirect(`/work-orders/${id}`)

  const selectedAssetIds = wo.assets.map((a: any) => a.assetId)

  const initialData = {
    title:           wo.title,
    description:     wo.description   ?? '',
    type:            wo.type,
    priority:        wo.priority,
    status:          wo.status,
    startDate:       wo.startDate ? new Date(wo.startDate).toISOString().split('T')[0] : '',
    startTime:       wo.startDate ? new Date(wo.startDate).toTimeString().slice(0, 5) : '',
    dueDate:         wo.dueDate ? new Date(wo.dueDate).toISOString().split('T')[0] : '',
    dueTime:         wo.dueDate ? new Date(wo.dueDate).toTimeString().slice(0, 5) : '',
    assetId:         wo.assetId       ?? '',
    locationId:      wo.locationId    ?? '',
    locationScope:   wo.locationScope ?? 'ALL_ASSETS',
    selectedAssetIds,
    assignedToId:    wo.assignedToId  ?? '',
    teamId:          wo.teamId        ?? '',
    laborHours:      wo.laborHours    != null ? String(wo.laborHours) : '',
    laborCost:       wo.laborCost     != null ? String(wo.laborCost)  : '',
    partsCost:       wo.partsCost     != null ? String(wo.partsCost)  : '',
    notes:           wo.notes         ?? '',
    issueId:         wo.issueId       ?? '',
    customIssue:     wo.customIssue   ?? '',
    customFields:    (wo.customFields as Record<string, any> | null) ?? null,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/work-orders/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to work order
        </Link>
      </div>
      <PageHeader title={`Edit: ${wo.title}`} subtitle={wo.woNumber} />
      <WorkOrderForm
        assets={assets}
        locations={locations}
        users={users}
        teams={teams}
        initialData={initialData}
        woId={id}
        meta={{
          woNumber: wo.woNumber,
          status: wo.status,
          createdAt: wo.createdAt,
          updatedAt: wo.updatedAt,
        }}
      />

      {(wo.repairSessions as any[]).length > 0 && (
        <div className="mt-6 premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
          <h2 className="font-bold text-slate-700 text-sm tracking-tight mb-4 pb-2 border-b border-slate-100">
            Repair Sessions
            <span className="ml-2 text-slate-400 font-normal">({(wo.repairSessions as any[]).length})</span>
          </h2>
          <div className="space-y-2">
            {(wo.repairSessions as any[]).map((session: any) => (
              <div key={session.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                    #{session.sessionNo}
                  </span>
                  <div className="text-xs text-slate-700">
                    <span className="font-medium">
                      {new Date(session.startedAt).toLocaleDateString()}{' '}
                      {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {session.completedAt && (
                      <>
                        <span className="text-slate-400 mx-1">&rarr;</span>
                        <span className="font-medium">
                          {new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                    {!session.completedAt && (
                      <span className="text-amber-600 ml-1 font-semibold">in progress</span>
                    )}
                    {session.startedBy && (
                      <span className="text-slate-400 ml-2">by {session.startedBy.name}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {session.durationMinutes != null && `${session.durationMinutes} min`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
