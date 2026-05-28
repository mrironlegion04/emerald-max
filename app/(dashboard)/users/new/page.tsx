import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import UserForm from '@/components/UserForm'

export default async function NewUserPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-1">
        <Link href="/users" className="text-sm text-gray-400 hover:text-gray-600">← Back to users</Link>
      </div>
      <PageHeader title="Add new user" subtitle="Create a login account for a team member." />
      <UserForm />
    </div>
  )
}
