'use client'

import { useState } from 'react'
import { Menu, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'

interface User {
  userId: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN'
}

interface MobileHeaderProps {
  user: User
}

export default function MobileHeader({ user }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/85 lg:hidden px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 -ml-1 text-slate-550 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95 border border-transparent hover:border-slate-205"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-7.5 h-7.5 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-600/30">
              <Settings className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-wider font-sans leading-none">EMERALD MAINTENANCE</span>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* Modern Drawer implementation with AnimatePresence */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Sidebar drawer container */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-white shadow-[8px_0_36px_rgba(15,23,42,0.08)] z-50 lg:hidden overflow-hidden"
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
