import { getCurrentUser } from '@/lib/session'
import PublicRequestForm from '@/components/PublicRequestForm'

export default async function RequestPage() {
  const user = await getCurrentUser()

  return (
    <PublicRequestForm
      currentUser={
        user ? { name: user.name, email: user.email, role: user.role } : null
      }
    />
  )
}
