import { getCurrentUser } from '@/lib/session'
import SidebarShell from '@/components/SidebarShell'
import BottomNav from '@/components/BottomNav'
import MobileHeader from '@/components/MobileHeader'
import NotificationBell from '@/components/NotificationBell'
import ServerLocationSwitcher from '@/components/ServerLocationSwitcher'

export default async function RequesterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  // The /request form is public — render it bare when logged out.
  if (!user) {
    return <div className="min-h-screen bg-slate-50">{children}</div>
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - fixed and visible on large screens */}
      <SidebarShell user={user} />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Mobile Header (hidden on desktop, handles hamburger, drawer, notifications) */}
        <MobileHeader user={user}>
          <ServerLocationSwitcher />
        </MobileHeader>

        {/* Desktop Topbar header (hidden on mobile and tablet) */}
        <div className="hidden lg:flex bg-white border-b border-slate-100 px-8 py-3.5 items-center justify-end gap-4 flex-shrink-0">
          <ServerLocationSwitcher />
          <NotificationBell />
        </div>

        {/* Main Viewport Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Screen bottom padding + Bottom Nav - shown on mobile screens */}
      <div className="lg:hidden">
        <BottomNav role={user.role} />
      </div>
    </div>
  )
}
