import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import PartForm from '@/components/PartForm'

export default async function NewPartPage() {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/inventory')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/inventory" className="text-sm text-gray-400 hover:text-gray-600">← Back to inventory</Link>
      </div>
      <PageHeader title="Add new part" subtitle="Register a new spare part in inventory." />
      <PartForm />
    </div>
  )
}
