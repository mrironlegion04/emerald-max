'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wrench, Package, Clock, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

interface Props {
  user: { name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN' }
}

export default function BottomNav({ user }: Props) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/work-orders', label: 'Work Orders', icon: Wrench },
    { href: '/assets', label: 'Assets', icon: Package },
    { href: '/preventive-maintenance', label: 'PM', icon: Clock },
  ]

  const moreItems = [
    { href: '/maintenance-requests', label: 'Requests' },
    { href: '/audit-log', label: 'Audit Log' },
    { href: '/reports', label: 'Reports' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/schedule', label: 'Schedule' },
    { href: '/teams', label: 'Teams' },
    { href: '/sites', label: 'Sites' },
  ]

  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    moreItems.push(
      { href: '/users', label: 'Users' },
      { href: '/import', label: 'Import' },
      { href: '/export', label: 'Export' }
    )
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile bottom navigation (only visible on small screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-40">
        <div className="flex items-center justify-around h-16">
          {navItems.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                  active
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}>
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] tracking-wide">{item.label}</span>
              </Link>
            )
          })}

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                moreOpen ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-800'
              }`}>
              <MoreHorizontal className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-wide">More</span>
            </button>

            {/* Dropdown menu */}
            {moreOpen && (
              <div className="absolute bottom-full right-0 bg-white border border-slate-100 rounded-xl shadow-xl mb-3 w-48 overflow-hidden py-1">
                {moreItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`block px-4 py-2.5 text-xs font-medium border-b border-slate-50 last:border-0 ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Padding for bottom nav on mobile */}
      <div className="md:hidden h-16" />
    </>
  )
}
