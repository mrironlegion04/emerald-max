import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import ShiftsManager from '@/components/ShiftsManager'

export default async function ShiftsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/work-orders')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <ShiftsManager />
    </div>
  )
}
