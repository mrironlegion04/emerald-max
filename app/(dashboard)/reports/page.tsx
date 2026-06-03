import { getCurrentUser } from '@/lib/session'
import PageHeader from '@/components/PageHeader'
import ReportsDashboard from '@/components/ReportsDashboard'

export default async function ReportsPage() {
  const user = await getCurrentUser()
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Maintenance performance overview across all assets and work orders."
      />
      <ReportsDashboard userRole={user?.role ?? 'TECHNICIAN'} />
    </div>
  )
}
