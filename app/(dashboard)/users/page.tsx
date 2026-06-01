import { redirect } from 'next/navigation'

export default function UsersPageRedirect() {
  redirect('/teams?tab=users')
}
