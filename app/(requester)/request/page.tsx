import { getCurrentUser } from '@/lib/session'
import PublicRequestForm from '@/components/PublicRequestForm'

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>
}) {
  const user = await getCurrentUser()
  const { assetId } = await searchParams

  return (
    <PublicRequestForm
      currentUser={
        user ? { name: user.name, email: user.email, role: user.role } : null
      }
      initialAssetId={assetId}
    />
  )
}
