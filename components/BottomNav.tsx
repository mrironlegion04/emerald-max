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
        <div className="mx-4 mb-6 hover:mb-7 transition-all duration-500 pointer-events-auto">
          <div className="relative flex items-center justify-between h-18 px-3 bg-white/70 backdrop-blur-2xl border border-white/40 shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-[32px] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent pointer-none" />
            
            {navItems.map((item, idx) => {
              const Icon = item.icon
              const active = isActive(item.href)

              if (item.isAction) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative -top-1 px-1 z-10"
                  >
                    <motion.div 
                      whileTap={{ scale: 0.9 }}
                      className={`flex flex-col items-center justify-center w-14 h-14 rounded-[20px] bg-slate-900 shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all ${active ? 'ring-2 ring-slate-900 ring-offset-4 ring-offset-white/80 scale-105' : ''}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-[20px] opacity-50" />
                      <Icon className="w-6 h-6 text-white relative z-10" />
                    </motion.div>
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 z-10 ${
                    active ? 'text-slate-900' : 'text-slate-400 font-medium'
                  }`}
                >
                  <motion.div
                    whileTap={{ scale: 0.85 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative mb-1">
                      {active && (
                        <motion.div
                          layoutId="activeTabIndicator"
                          className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-slate-900 shadow-[0_0_8px_rgba(0,0,0,0.2)]"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={`w-5 h-5 transition-all duration-500 ${active ? 'scale-110 stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                    </div>
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${active ? 'font-bold opacity-100 mt-0.5' : 'font-semibold opacity-80'}`}>
                      {item.label}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="lg:hidden h-24 pb-safe" />
    </>
  )
}
