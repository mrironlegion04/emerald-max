'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Package, MessageCircle, MoreHorizontal } from 'lucide-react'
import { motion } from 'motion/react'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/overview', label: 'Overview', icon: LayoutDashboard },
    { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
    { href: '/assets', label: 'Assets', icon: Package },
    { href: '/messages', label: 'Messages', icon: MessageCircle },
    { href: '/more', label: 'More', icon: MoreHorizontal },
  ]

  const isActive = (href: string) => {
    if (href === '/overview') return pathname === '/overview' || pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none pb-safe pointer-events-none">
        <div className="mx-4 mb-4 pointer-events-auto">
          <div className="relative flex items-center justify-between h-16 px-1 bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[24px] overflow-hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)

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
                      className="absolute top-2 w-1.5 h-1.5 rounded-full bg-slate-900"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={`w-5 h-5 mb-1 transition-transform ${active ? 'scale-110' : ''}`} />
                  <span className={`text-[10px] font-medium tracking-tight ${active ? 'font-bold' : ''}`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="lg:hidden h-20 pb-safe" />
    </>
  )
}
