'use client'

import { useState } from 'react'
import { Menu, Settings } from 'lucide-react'
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
      <header className="bg-white border-b border-gray-200 lg:hidden px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">EMERALD MAX</span>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* Drawer Overlay backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div className={`fixed top-0 bottom-0 left-0 w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="w-full h-full">
          <Sidebar user={user} isMobile onClose={() => setIsOpen(false)} />
        </div>
      </div>
    </>
  )
}
