import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import MaintenanceOverview from '@/components/MaintenanceOverview'

export const metadata = {
  title: 'Maintenance Report',
  description: 'Overview of maintenance work orders by plant',
}

export default async function MaintenanceReportPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Maintenance Overview"
        subtitle="Work order analytics across all plants"
      />
      <MaintenanceOverview />
    </div>
  )
}
