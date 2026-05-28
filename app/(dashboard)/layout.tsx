import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import NotificationBell from '@/components/NotificationBell'
import { Settings } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const initials = user.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar user={user} />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          {/* Mobile-only branding */}
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">EMERALD MAX</span>
            </div>
          </div>

          {/* Desktop placeholder spacing to push items right when no mobile branding */}
          <div className="hidden md:block" />

          {/* Right section: Alerts, user actions */}
          <div className="flex items-center gap-4">
            <NotificationBell />
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Profile trigger / display */}
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-none">{user.name}</p>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</span>
              </div>
              <div className="w-8 h-8 bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs select-none shadow-sm cursor-default">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 pb-24 md:pb-6">
          {children}
        </div>
      </main>
      {/* Bottom Nav - shown on mobile */}
      <BottomNav user={user} />
    </div>
  )
}

