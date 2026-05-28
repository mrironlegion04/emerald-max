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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around h-20">
          {navItems.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-16 h-16 text-xs font-medium transition-colors ${
                  active
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}>
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </Link>
            )
          })}

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex flex-col items-center justify-center w-16 h-16 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <MoreHorizontal className="w-5 h-5 mb-1" />
              <span className="text-xs">More</span>
            </button>

            {/* Dropdown menu */}
            {moreOpen && (
              <div className="absolute bottom-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg mb-2 w-48">
                {moreItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`block px-4 py-2 text-sm font-medium border-b border-gray-100 last:border-0 ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
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
      <div className="md:hidden h-20" />
    </>
  )
}
