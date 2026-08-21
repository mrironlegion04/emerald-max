'use client'

import { useState, useEffect, useCallback } from 'react'
import { Cog } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'

interface User {
  userId: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'REQUESTER' | 'VIEWER'
}

interface MobileHeaderProps {
  user: User
  children?: React.ReactNode
}

const SIDEBAR_EVENT = 'emerald:open-sidebar'

export function openMobileSidebar() {
  window.dispatchEvent(new Event(SIDEBAR_EVENT))
}

export default function MobileHeader({ user, children }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => setIsOpen(true), [])

  useEffect(() => {
    window.addEventListener(SIDEBAR_EVENT, handleOpen)
    return () => window.removeEventListener(SIDEBAR_EVENT, handleOpen)
  }, [handleOpen])

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/85 lg:hidden px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 -ml-1 p-1 rounded-xl hover:bg-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95"
            aria-label="Open navigation menu"
          >
            <div className="w-7.5 h-7.5 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-600/30">
              <Cog className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-wider font-sans leading-none hidden sm:inline">EMERALD MAINTENANCE</span>
            <span className="font-extrabold text-slate-900 text-sm tracking-wider font-sans leading-none sm:hidden">EMERALD</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {children}
          <NotificationBell />
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-white shadow-[8px_0_36px_rgba(15,23,42,0.08)] z-[70] lg:hidden overflow-hidden"
            >
              <div className="w-full h-full">
                <Sidebar user={user} isMobile onClose={() => setIsOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
