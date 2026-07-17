import { getCurrentUser } from '@/lib/session'
import MoreScreen from '@/components/MoreScreen'

export default async function MorePage() {
  const user = await getCurrentUser()

  return <MoreScreen userRole={user?.role ?? 'TECHNICIAN'} />
}
