export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import BulkImport from '@/components/BulkImport'

export default async function ImportPage() {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Bulk Import"
        subtitle="Import assets or spare parts from a CSV file."
      />
      <BulkImport />
    </div>
  )
}