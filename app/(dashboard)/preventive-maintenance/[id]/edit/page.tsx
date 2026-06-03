export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import PMScheduleForm from '@/components/PMScheduleForm'

export default async function EditPMPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect(`/preventive-maintenance/${id}`)

  const [schedule, assets, locations, procedures] = await Promise.all([
    prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        procedures: {
          include: {
            procedure: true,
          },
        },
      },
    }),
    prisma.asset.findMany({
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select:  { id: true, name: true, assetCode: true, imageUrl: true, parentId: true, locationId: true, categoryId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select:  { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.procedure.findMany({
      select:  { id: true, name: true, description: true, steps: { select: { id: true } }, locations: { select: { id: true } }, categories: { select: { id: true } }, assets: { select: { id: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!schedule) notFound()

  const initialData = {
    title:               schedule.title,
    description:         schedule.description  ?? '',
    triggerType:         schedule.triggerType,
    frequency:           schedule.frequency,
    interval:            String(schedule.interval),
    meterInterval:       schedule.meterInterval != null ? String(schedule.meterInterval) : '',
    meterUnit:           schedule.meterUnit     ?? '',
    nextDueDate:         new Date(schedule.nextDueDate).toISOString().split('T')[0],
    assetId:             schedule.assetId       ?? '',
    locationId:          schedule.locationId    ?? '',
    locationScope:       schedule.locationScope ?? 'ALL_ASSETS',
    isActive:            schedule.isActive,
    procedures:          schedule.procedures,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/preventive-maintenance/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to schedule
        </Link>
      </div>
      <PageHeader title={`Edit: ${schedule.title}`} />
      <PMScheduleForm assets={assets} locations={locations} procedures={procedures} initialData={initialData} scheduleId={id} />
    </div>
  )
}
