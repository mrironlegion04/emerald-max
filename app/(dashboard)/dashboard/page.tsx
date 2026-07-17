import { getCurrentUser } from '@/lib/session'
import DashboardOverview from '@/components/DashboardOverview'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return <DashboardOverview userName={firstName} />
}
