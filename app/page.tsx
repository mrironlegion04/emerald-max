import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'

export default async function Home() {
  const user = await getCurrentUser()
  if (user) {
    if (user.role === 'REQUESTER') {
      redirect('/my-requests')
    } else {
      redirect('/work-orders')
    }
  } else {
    redirect('/login')
  }
}