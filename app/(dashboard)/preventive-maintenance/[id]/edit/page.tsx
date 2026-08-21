import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPickerScope, getWriteScopeIds, hasScopeActionFlag } from '@/lib/access-control'
import { hasPermission } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import PMScheduleForm from '@/components/PMScheduleForm'
import type { RecurrenceRule } from '@/lib/pm-generation'

export default async function EditPMPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !(await hasScopeActionFlag(user, 'canManagePM')) || !(await hasPermission(user, 'pm:edit'))) redirect(`/preventive-maintenance/${id}`)

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

  const [schedule, assets, locations, users, teams] = await Promise.all([
    prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
          select: { title: true, description: true, priority: true, order: true, assignedToId: true, assignedTeamId: true, required: true },
        },
        asset: { select: { id: true, locationId: true } },
        assets: { select: { asset: { select: { id: true, locationId: true } } } },
      },
    }),
    prisma.asset.findMany({
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' }, ...(assetFilter ?? {}) },
      select:  { id: true, name: true, assetCode: true, imageUrl: true, parentId: true, locationId: true, categoryId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      where:   scopeIds ? { id: { in: scopeIds } } : {},
      select:  { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where:   { isActive: true, ...(userFilter ?? {}) },
      select:  { id: true, name: true, email: true, username: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where:   { isActive: true, ...(scopeUserIds ? { members: { some: { userId: { in: scopeUserIds } } } } : {}) },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!schedule) notFound()

  // Plant isolation: managers must have access to ALL locations in the schedule to edit
  if (user && scopeIds) {
    const scheduleLocations = new Set<string>()
    if (schedule.locationId) scheduleLocations.add(schedule.locationId)
    if (schedule.asset?.locationId) scheduleLocations.add(schedule.asset.locationId)
    for (const a of schedule.assets) {
      if (a.asset.locationId) scheduleLocations.add(a.asset.locationId)
    }
    const allInScope = [...scheduleLocations].every(locId => scopeIds.includes(locId))
    if (!allInScope) redirect(`/preventive-maintenance/${id}`)
  }

  const initialData = {
    title:               schedule.title,
    description:         schedule.description  ?? '',
    triggerType:         schedule.triggerType,
    frequency:           schedule.frequency,
    interval:            String(schedule.interval),
    meterInterval:       schedule.meterInterval != null ? String(schedule.meterInterval) : '',
    meterUnit:           schedule.meterUnit     ?? '',
    meterId:             schedule.meterId       ?? '',
    nextDueDate:         new Date(schedule.nextDueDate).toISOString().split('T')[0],
    assetId:             schedule.assetId       ?? '',
    assetIds:            schedule.assets.length > 0
      ? schedule.assets.map(a => a.asset.id)
      : (schedule.assetId ? [schedule.assetId] : []),
    locationId:          schedule.locationId    ?? '',
    locationScope:       schedule.locationScope ?? 'ALL_ASSETS',
    isActive:            schedule.isActive,
    scheduleBehavior:    schedule.scheduleBehavior,
    schedulingHorizon:   String(schedule.schedulingHorizon),
    nestedConfig:        schedule.nestedConfig as any[] | null,
    woPriority:          schedule.woPriority,
    woDescription:       schedule.woDescription ?? '',
    woAssignedToId:      schedule.woAssignedToId ?? '',
    woTeamId:            schedule.woTeamId       ?? '',
    startDateOffset:     String(schedule.startDateOffset),
    nestedStartIndex:    String(schedule.nestedStartIndex),
    recurrenceRule:      schedule.recurrenceRule as unknown as RecurrenceRule | null,
    occurrenceLimit:     schedule.occurrenceLimit != null ? String(schedule.occurrenceLimit) : '',
    endDate:             schedule.endDate ? new Date(schedule.endDate).toISOString().split('T')[0] : '',
    tasks:               (schedule.tasks ?? []).map(t => ({
      title:        t.title,
      description:  t.description ?? '',
      priority:     t.priority,
      assignedToId: t.assignedToId ?? '',
      assignedTeamId: t.assignedTeamId ?? '',
      required:     t.required ?? true,
    })),
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/preventive-maintenance/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to schedule
        </Link>
      </div>
      <PageHeader title={`Edit: ${schedule.title}`} />
      <PMScheduleForm assets={assets} locations={locations} users={users} teams={teams} initialData={initialData} scheduleId={id} />
    </div>
  )
}
