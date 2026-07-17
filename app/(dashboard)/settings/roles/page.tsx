import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import RolesManager from '@/components/RolesManager'

export default async function RolesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'TECHNICIAN' || user.role === 'REQUESTER') redirect('/work-orders')

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <RolesManager />
    </div>
  )
}
