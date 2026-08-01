import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user || user.role === 'TECHNICIAN') {
    redirect('/dashboard')
  }

  redirect('/teams?tab=users')
}
