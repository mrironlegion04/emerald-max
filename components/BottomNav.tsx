'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wrench, Package, Clock, QrCode } from 'lucide-react'
import { motion } from 'motion/react'

interface Props {
  user: { name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN' }
}

export default function BottomNav({ user }: Props) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/work-orders', label: 'Tasks', icon: Wrench },
    { href: '/scan', label: 'Scan', icon: QrCode, isAction: true },
    { href: '/assets', label: 'Assets', icon: Package },
    { href: '/preventive-maintenance', label: 'PM', icon: Clock },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/scan') return pathname === '/scan'
    return pathname?.startsWith(href)
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none pb-safe pointer-events-none">
        <div className="mx-4 mb-4 pointer-events-auto">
          <div className="relative flex items-center justify-between h-16 px-2 bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[24px] overflow-hidden">
            {navItems.map((item, idx) => {
              const Icon = item.icon
              const active = isActive(item.href)

              if (item.isAction) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative -top-1 px-1"
                  >
                    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 shadow-lg shadow-slate-900/20 transition-transform active:scale-95 ${active ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </Link>
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
