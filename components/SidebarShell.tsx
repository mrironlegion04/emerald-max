'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import type { User } from '@/components/Sidebar'

const STORAGE_KEY = 'emerald.sidebar.collapsed'

export default function SidebarShell({ user }: { user: User }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
      } catch {
        /* storage unavailable — keep default */
      }
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const apply = (next: boolean) => {
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`hidden lg:flex flex-shrink-0 transition-[width] duration-200 ease-in-out ${
        collapsed ? 'lg:w-20' : 'lg:w-64'
      }`}
    >
      <Sidebar
        user={user}
        collapsed={collapsed}
        onToggleCollapsed={() => apply(!collapsed)}
        onExpand={() => apply(false)}
      />
    </div>
  )
}
