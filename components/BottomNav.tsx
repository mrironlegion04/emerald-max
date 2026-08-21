'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Package, MessageCircle, MoreHorizontal, Plus, ScanLine } from 'lucide-react'
import { motion } from 'motion/react'
import { openMobileSidebar } from '@/components/MobileHeader'

type Role = 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'REQUESTER' | 'VIEWER'

export default function BottomNav({ role }: { role?: Role }) {
  const pathname = usePathname()

  const navItems =
    role === 'REQUESTER'
      ? [
          { href: '/my-work-orders', label: 'Work Orders', icon: ClipboardList },
          { href: '/request/scan', label: 'Scan', icon: ScanLine },
          { href: '/request', label: 'New WO', icon: Plus },
        ]
      : [
          { href: '/overview', label: 'Overview', icon: LayoutDashboard },
          { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
          { href: '/assets', label: 'Assets', icon: Package },
          { href: '/messages', label: 'Messages', icon: MessageCircle },
          { label: 'More', icon: MoreHorizontal, onClick: openMobileSidebar },
        ]

  const isActive = (href?: string) => {
    if (!href) return false
    if (href === '/overview') return pathname === '/overview' || pathname === '/dashboard'
    if (href === '/request') return pathname === '/request' || pathname?.startsWith('/request/')
    return pathname?.startsWith(href)
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none pointer-events-auto border-t border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-between h-14 px-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            if ('onClick' in item) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="relative flex flex-col items-center justify-center flex-1 h-full transition-all text-slate-400"
                >
                  <Icon className="w-5 h-5 mb-0.5 transition-transform" />
                  <span className="text-[10px] font-medium tracking-tight">
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all ${
                  active ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute top-0 w-8 h-0.5 rounded-full bg-slate-900"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 mb-0.5 transition-transform ${active ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-medium tracking-tight ${active ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="lg:hidden h-14" />
    </>
  )
}
