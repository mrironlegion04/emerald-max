import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import WOCategoriesManager from '@/components/WOCategoriesManager'

export default async function WOCategoriesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/work-orders')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <WOCategoriesManager />
    </div>
  )
}
