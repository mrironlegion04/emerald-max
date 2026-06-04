'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'
import { motion } from 'motion/react'
import {
  Home,
  Box,
  Building2,
  MapPin,
  ClipboardList,
  Calendar,
  Clock,
  MessageSquare,
  MessageCircle,
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
  X,
  ChevronDown,
  ChevronRight,
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
    icon: <Home className="w-4.5 h-4.5" />,
  },
  {
    label: 'To Do',
    href: '/to-do',
    icon: <CheckSquare className="w-4.5 h-4.5" />,
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: <MessageCircle className="w-4.5 h-4.5" />,
  },
  {
    label: 'Meters',
    href: '/meters',
    icon: <Gauge className="w-4.5 h-4.5" />,
  },
  {
    label: 'Work Orders',
    href: '/work-orders',
    icon: <ClipboardList className="w-4.5 h-4.5" />,
  },
  {
    label: 'Preventive Maint.',
    href: '/preventive-maintenance',
    icon: <Calendar className="w-4.5 h-4.5" />,
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: <Clock className="w-4.5 h-4.5" />,
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: <Calendar className="w-4.5 h-4.5" />,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: <Box className="w-4.5 h-4.5" />,
  },
  {
    label: 'Requests',
    href: '/requests',
    icon: <MessageSquare className="w-4.5 h-4.5" />,
  },
]

// Visible to ADMIN and MANAGER
const managerItems = [
  {
    label: 'Teams / Users',
    href: '/teams',
    icon: <Users className="w-4.5 h-4.5" />,
  },
]

// Visible to ADMIN only
const adminItems = [
  {
    label: 'Audit Log',
    href: '/audit-log',
    icon: <Shield className="w-4.5 h-4.5" />,
  },
]

// Foldered items
const assetGroupItems = [
  {
    label: 'Assets Directory',
    href: '/assets',
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    label: 'Asset Explorer',
    href: '/asset-explorer',
    icon: <FolderTree className="w-4 h-4" />,
  },
]

const reportGroupItems = [
  {
    label: 'Reports Dashboard',
    href: '/reports',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    label: 'Maintenance Report',
    href: '/reports/maintenance',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    label: 'SLA Breach Reports',
    href: '/sla-breach-reports',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  {
    label: 'Sites Overview',
    href: '/sites',
    icon: <Globe className="w-4 h-4" />,
    adminOnly: true,
  },
]

const enterpriseSettingsItems = [
  {
    label: 'Procedures',
    href: '/settings/procedures',
    icon: <ClipboardCheck className="w-4 h-4" />,
  },
  {
    label: 'Locations',
    href: '/settings/locations',
    icon: <MapPin className="w-4 h-4" />,
  },
  {
    label: 'Asset Types',
    href: '/settings/asset-types',
    icon: <Tag className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Asset Categories',
    href: '/settings/asset-categories',
    icon: <FolderTree className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'BOM Templates',
    href: '/settings/bom-templates',
    icon: <ClipboardCheck className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Domains',
    href: '/settings/domains',
    icon: <Layers className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Issues',
    href: '/settings/issues',
    icon: <AlertCircle className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'SLA Policies',
    href: '/sla-policies',
    icon: <Shield className="w-4 h-4" />,
    adminOnly: true,
  },
  {
    label: 'Bulk Import',
    href: '/import',
    icon: <Upload className="w-4 h-4" />,
    managerOrAdmin: true,
  },
]

const roleColors: Record<string, string> = {
  ADMIN: 'bg-indigo-50 border-indigo-100 text-indigo-700',
  MANAGER: 'bg-blue-50 border-blue-100 text-blue-700',
  TECHNICIAN: 'bg-emerald-50 border-emerald-100 text-emerald-700',
}

export default function Sidebar({ user, onClose, isMobile }: { user: User; onClose?: () => void; isMobile?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const isAssetsActive = pathname.startsWith('/assets') || pathname.startsWith('/asset-explorer')
    const isReportsActive = pathname.startsWith('/reports') || pathname.startsWith('/sla-breach-reports') || pathname.startsWith('/sites')
    const isSettingsActive = pathname.startsWith('/settings') || pathname.startsWith('/sla-policies') || pathname.startsWith('/import')
    return {
      assets: isAssetsActive,
      reports: isReportsActive,
      settings: isSettingsActive,
    }
  })

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

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  const isAssetsActive = pathname.startsWith('/assets') || pathname.startsWith('/asset-explorer')
  const isReportsActive = pathname.startsWith('/reports') || pathname.startsWith('/sla-breach-reports') || pathname.startsWith('/sites')
  const isSettingsActive = pathname.startsWith('/settings') || pathname.startsWith('/sla-policies') || pathname.startsWith('/import')

  return (
    <aside className="w-full h-full bg-white border-r border-slate-200 flex flex-col flex-shrink-0 shadow-xs">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-linear-to-b from-slate-50/20 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)] border border-blue-500/30">
            <Settings className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-sm tracking-wider leading-none font-sans">EMERALD MAX</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Maintenance System</p>
          </div>
        </div>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto scrollbar-thin select-none">
        {/* Modern styled QR Scan Link */}
        <Link
          href="/scan"
          onClick={onClose}
          className={clsx(
            'sidebar-link justify-center bg-blue-50/40 text-blue-600 border border-blue-200/60 hover:bg-blue-50 mb-3.5 shadow-3xs lg:hidden',
            { '!bg-blue-600 !text-white !border-blue-700': isActive('/scan') }
          )}
        >
          <QrCode className="w-4.5 h-4.5" />
          <span className="font-bold">Scan Asset QR</span>
        </Link>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-1">
          Menu
        </p>

        <div className="space-y-1">
          {navItems.map(item => {
            const active = isActive(item.href)
            return (
              <div key={item.href} className="relative">
                {active && (
                  <motion.div 
                    layoutId="activeSideIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-lg z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={clsx('sidebar-link group', { 'active !bg-blue-50/70': active })}
                >
                  <span className={clsx('transition-colors', active ? 'text-blue-600 font-semibold' : 'text-slate-400 group-hover:text-slate-700')}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </div>
            )
          })}
        </div>

        {/* Privileged Controls for Admin / Manager */}
        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-6 mb-2">
              Privileged controls
            </p>
            <div className="space-y-1.5">
              {/* Direct Link: Teams / Users */}
              {managerItems.map(item => {
                const active = isActive(item.href)
                return (
                  <div key={item.href} className="relative">
                    {active && (
                      <motion.div 
                        layoutId="activeSideIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-lg z-10"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={clsx('sidebar-link group', { 'active !bg-blue-50/70': active })}
                    >
                      <span className={clsx('transition-colors', active ? 'text-blue-600 font-semibold' : 'text-slate-400 group-hover:text-slate-700')}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </div>
                )
              })}

              {/* Direct Link: Audit Log */}
              {user.role === 'ADMIN' && adminItems.map(item => {
                const active = isActive(item.href)
                return (
                  <div key={item.href} className="relative">
                    {active && (
                      <motion.div 
                        layoutId="activeSideIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-lg z-10"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={clsx('sidebar-link group', { 'active !bg-blue-50/70': active })}
                    >
                      <span className={clsx('transition-colors', active ? 'text-blue-600 font-semibold' : 'text-slate-400 group-hover:text-slate-700')}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </div>
                )
              })}

              {/* Collapsible: Assets Folder */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleGroup('assets')}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-slate-50 text-slate-705 cursor-pointer select-none',
                    { 'text-blue-600 bg-blue-50/20': isAssetsActive && !openGroups.assets }
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={clsx('transition-colors', isAssetsActive ? 'text-blue-600' : 'text-slate-400')}>
                      <Building2 className="w-4.5 h-4.5" />
                    </span>
                    <span>Assets Folder</span>
                  </div>
                  <span>
                    {openGroups.assets ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </span>
                </button>

                {openGroups.assets && (
                  <div className="ml-4 pl-3.5 border-l border-slate-105 flex flex-col gap-0.5 mt-0.5 relative">
                    {assetGroupItems.map(item => {
                      const active = isActive(item.href)
                      return (
                        <div key={item.href} className="relative">
                          {active && (
                            <motion.div 
                              layoutId="activeSideIndicator"
                              className="absolute left-[-15px] top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-600 rounded-r-lg z-10"
                              transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            />
                          )}
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={clsx(
                              'sidebar-link group text-xs !py-1.5 pl-2',
                              { 'active !bg-blue-50/70': active }
                            )}
                          >
                            <span className={clsx('transition-colors', active ? 'text-blue-600 font-semibold' : 'text-slate-400 group-hover:text-slate-750')}>{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Collapsible: Reports */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleGroup('reports')}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-slate-50 text-slate-705 cursor-pointer select-none',
                    { 'text-blue-600 bg-blue-50/20': isReportsActive && !openGroups.reports }
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={clsx('transition-colors', isReportsActive ? 'text-blue-600' : 'text-slate-400')}>
                      <BarChart3 className="w-4.5 h-4.5" />
                    </span>
                    <span>Reports</span>
                  </div>
                  <span>
                    {openGroups.reports ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </span>
                </button>

                {openGroups.reports && (
                  <div className="ml-4 pl-3.5 border-l border-slate-105 flex flex-col gap-0.5 mt-0.5 relative">
                    {reportGroupItems
                      .filter(item => !item.adminOnly || user.role === 'ADMIN')
                      .map(item => {
                        const active = isActive(item.href)
                        return (
                          <div key={item.href} className="relative">
                            {active && (
                              <motion.div 
                                layoutId="activeSideIndicator"
                                className="absolute left-[-15px] top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-600 rounded-r-lg z-10"
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={clsx(
                                'sidebar-link group text-xs !py-1.5 pl-2',
                                { 'active !bg-blue-50/70': active }
                              )}
                            >
                              <span className={clsx('transition-colors', active ? 'text-blue-600 font-semibold' : 'text-slate-400 group-hover:text-slate-705')}>{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Collapsible: Settings */}
              <div className="space-y-1">
                <button
                  onClick={() => toggleGroup('settings')}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-slate-50 text-slate-705 cursor-pointer select-none',
                    { 'text-blue-600 bg-blue-50/20': isSettingsActive && !openGroups.settings }
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={clsx('transition-colors', isSettingsActive ? 'text-blue-600' : 'text-slate-400')}>
                      <Settings className="w-4.5 h-4.5" />
                    </span>
                    <span>Settings</span>
                  </div>
                  <span>
                    {openGroups.settings ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </span>
                </button>

                {openGroups.settings && (
                  <div className="ml-4 pl-3.5 border-l border-slate-105 flex flex-col gap-0.5 mt-0.5 relative font-mono">
                    {enterpriseSettingsItems
                      .filter(item => {
                        if (item.adminOnly && user.role !== 'ADMIN') return false
                        if (item.managerOrAdmin && user.role !== 'ADMIN' && user.role !== 'MANAGER') return false
                        return true
                      })
                      .map(item => {
                        const active = isActive(item.href)
                        return (
                          <div key={item.href} className="relative">
                            {active && (
                              <motion.div 
                                layoutId="activeSideIndicator"
                                className="absolute left-[-15px] top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-600 rounded-r-lg z-10"
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={clsx(
                                'sidebar-link group text-xs !py-1.5 pl-2 font-sans',
                                { 'active !bg-blue-50/70': active }
                              )}
                            >
                              <span className={clsx('transition-colors', active ? 'text-blue-600 font-semibold' : 'text-slate-400 group-hover:text-slate-705')}>{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* User Session Footer */}
      <div className="border-t border-slate-200/80 p-4 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2 py-2 mb-2 bg-white rounded-xl border border-slate-200/50 p-2 shadow-3xs select-none">
          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 font-bold border border-blue-200 shadow-3xs">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{user.name}</p>
            <div className="mt-1 flex">
              <span className={clsx('badge !px-1.5 !py-0.2 border text-[10px] font-bold tracking-wide rounded-md', roleColors[user.role])}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        <Link
          href="/profile"
          onClick={onClose}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors font-semibold"
        >
          <Settings className="w-3.5 h-3.5" />
          My Security Settings
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors font-semibold active:scale-[0.98]"
        >
          <LogOut className="w-3.5 h-3.5" />
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
