export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import MaintenanceDetail from '@/components/MaintenanceDetail'

export const metadata = {
  title: 'Maintenance Detail Report',
  description: 'Detailed maintenance work order report for a plant',
}

interface Props {
  params: Promise<{ locationId: string }>
}

export default async function MaintenanceDetailPage({ params }: Props) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const canExport = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const { locationId } = await params

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link href="/reports/maintenance" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Overview
        </Link>
      </div>
      <MaintenanceDetail locationId={locationId} canExport={canExport} />
    </div>
  )
}
