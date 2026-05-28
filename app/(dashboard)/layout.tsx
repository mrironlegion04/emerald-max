import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import NotificationBell from '@/components/NotificationBell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar user={user} />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
          <NotificationBell />
        </div>
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      {/* Bottom Nav - shown on mobile */}
      <BottomNav user={user} />
    </div>
  )
}

