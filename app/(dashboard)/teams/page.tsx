import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import TeamsAndUsersManager from '@/components/TeamsAndUsersManager'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'REQUESTER') redirect('/request')

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <TeamsAndUsersManager />
    </div>
  )
}
