import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import UsersManager from '@/components/UsersManager'

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user || user.role === 'TECHNICIAN') {
    redirect('/dashboard')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Users Directory"
        subtitle="Manage employees, technicians, system permission profiles, and direct engineering group assignments."
      />
      <UsersManager />
    </div>
  )
}
