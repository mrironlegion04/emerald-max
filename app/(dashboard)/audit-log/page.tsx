import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AuditLogTable from '@/components/AuditLogTable'
import ExportButton from '@/components/ExportButton'

export default async function AuditLogPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Audit Log"
        subtitle="Full history of all create, update, delete and status change events."
        action={<ExportButton types={['audit']} label="Export log" />}
      />
      <AuditLogTable />
    </div>
  )
}