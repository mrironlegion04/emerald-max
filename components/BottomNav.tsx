'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wrench, Package, Clock, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

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
    { href: '/requests', label: 'Requests' },
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] z-40 select-none pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${
                  active
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-500 active:text-slate-800'
                }`}>
                {active && (
                  <motion.span 
                    layoutId="activeBottomTab"
                    className="absolute inset-0 bg-blue-50/70 rounded-2xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] tracking-wider uppercase font-bold">{item.label}</span>
              </Link>
            )
          })}

          {/* More menu trigger button */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${
                moreOpen ? 'text-blue-600 font-bold bg-blue-50/70' : 'text-slate-500 active:text-slate-800'
              }`}>
              <MoreHorizontal className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] tracking-wider uppercase font-bold">More</span>
            </button>

            {/* Premium Animated Dropdown menu container */}
            <AnimatePresence>
              {moreOpen && (
                <>
                  {/* Overlay background to dismiss */}
                  <div 
                    className="fixed inset-0 bg-transparent z-40" 
                    onClick={() => setMoreOpen(false)}
                  />

                  {/* Bubble dropdown list */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute bottom-full right-0 bg-white border border-slate-200 rounded-2xl shadow-xl mb-4 w-52 overflow-hidden py-1.5 z-50 mr-[-8px] max-h-[350px] overflow-y-auto scrollbar-thin"
                  >
                    <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                      Explore options
                    </div>
                    {moreItems.map(item => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`block px-4 py-2.5 text-xs font-bold transition-colors ${
                            active
                              ? 'bg-blue-50/70 text-blue-600'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}>
                          {item.label}
                        </Link>
                      )
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* Padding space for bottom nav on mobile to prevent layouts overlapping */}
      <div className="md:hidden h-16 pb-safe" />
    </>
  )
}
