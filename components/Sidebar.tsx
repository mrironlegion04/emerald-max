'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'
import {
  Home,
  Box,
  Building2,
  MapPin,
  ClipboardList,
  Calendar,
  Clock,
  MessageSquare,
  BarChart3,
  Upload,
  Users,
  Globe,
  Shield,
  Settings,
  QrCode,
  LogOut,
  ClipboardCheck,
  FolderTree,
  Tag,
  Layers,
  AlertCircle,
  CheckSquare,
  Gauge,
} from 'lucide-react'

interface User {
  userId: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN'
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'To Do',
    href: '/to-do',
    icon: <CheckSquare className="w-5 h-5" />,
  },
  {
    label: 'Assets',
    href: '/assets',
    exact: false,
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Asset Explorer',
    href: '/asset-explorer',
    icon: <FolderTree className="w-5 h-5" />,
  },
  {
    label: 'Meters',
    href: '/meters',
    icon: <Gauge className="w-5 h-5" />,
  },
  {
    label: 'Work Orders',
    href: '/work-orders',
    icon: <ClipboardList className="w-5 h-5" />,
  },
  {
    label: 'Preventive Maint.',
    href: '/preventive-maintenance',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: <Clock className="w-5 h-5" />,
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: <Box className="w-5 h-5" />,
  },
  {
    label: 'Requests',
    href: '/requests',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    label: 'Maintenance Report',
    href: '/reports/maintenance',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    label: 'SLA Breach Reports',
    href: '/sla-breach-reports',
    icon: <BarChart3 className="w-5 h-5" />,
  },
]

// Visible to ADMIN and MANAGER
const managerItems = [
  {
    label: 'Bulk Import',
    href: '/import',
    icon: <Upload className="w-5 h-5" />,
  },
  {
    label: 'Teams',
    href: '/teams',
    icon: <Users className="w-5 h-5" />,
  },
]

// Visible to ADMIN only
const adminItems = [
  {
    label: 'Users',
    href: '/users',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Sites Overview',
    href: '/sites',
    icon: <Globe className="w-5 h-5" />,
  },
  {
    label: 'SLA Policies',
    href: '/sla-policies',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    label: 'Audit Log',
    href: '/audit-log',
    icon: <Shield className="w-5 h-5" />,
  },
]

// Visible to ADMIN and MANAGER: Settings section
const settingsItems = [
  {
    label: 'Checklist Templates',
    href:  '/settings/checklist-templates',
    icon:  <ClipboardCheck className="w-4 h-4" />,
    adminOnly: false,
  },
  {
    label: 'Locations',
    href:  '/settings/locations',
    icon:  <MapPin className="w-4 h-4" />,
    adminOnly: false,
  },
  {
    label: 'Asset Types',
    href:  '/settings/asset-types',
    icon:  <Tag className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Asset Categories',
    href:  '/settings/asset-categories',
    icon:  <FolderTree className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'BOM Templates',
    href:  '/settings/bom-templates',
    icon:  <ClipboardCheck className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Domains',
    href:  '/settings/domains',
    icon:  <Layers className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Issues',
    href:  '/settings/issues',
    icon:  <AlertCircle className="w-4 h-4" />,
    adminOnly: true,
  },
]

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  TECHNICIAN: 'bg-green-100 text-green-700',
}

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">EMERALD MAX</p>
          <p className="text-xs text-gray-400">Maintenance System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* QR Scan Button - Prominent for mobile technicians */}
        <Link
          href="/scan"
          className={clsx('sidebar-link justify-center text-blue-600 hover:bg-blue-50 border-2 border-blue-200 mb-3', { active: isActive('/scan') })}
        >
          <QrCode className="w-5 h-5" />
          <span className="font-semibold">Scan QR</span>
        </Link>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
          Main
        </p>

        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx('sidebar-link', { active: isActive(item.href) })}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}

        {/* Manager + Admin section */}
        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-5 mb-2">
              Management
            </p>
            {managerItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx('sidebar-link', { active: isActive(item.href) })}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}

        {/* Admin only section */}
        {user.role === 'ADMIN' && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-5 mb-2">
              Admin
            </p>
            {adminItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx('sidebar-link', { active: isActive(item.href) })}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
          {/* Settings section — ADMIN + MANAGER */}
          {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-5 mb-2">
                Settings
              </p>
              {settingsItems
                .filter(item => !item.adminOnly || user.role === 'ADMIN')
                .map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx('sidebar-link text-sm', { active: isActive(item.href) })}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 font-semibold text-xs">
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <span className={clsx('badge text-xs', roleColors[user.role])}>
              {user.role}
            </span>
          </div>
        </div>
        <Link
          href="/profile"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Settings className="w-4 h-4" />
          My Profile
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}