import { getCurrentUser } from '@/lib/session'
import MobileOverview from '@/components/MobileOverview'

export default async function OverviewPage() {
  const user = await getCurrentUser()
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return <MobileOverview userName={firstName} />
}
