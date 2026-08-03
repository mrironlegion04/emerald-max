import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import RequesterHeader from '@/components/RequesterHeader'

export default async function RequesterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <RequesterHeader />
        <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  )
}
