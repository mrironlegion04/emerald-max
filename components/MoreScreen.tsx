'use client'

import Link from 'next/link'
import {
  Gauge, Calendar, Box, MessageSquare, QrCode, BarChart3,
  Upload, Settings, Shield, Users, FileText, MapPin,
  ChevronRight,
} from 'lucide-react'

interface Props {
  userRole: string
}

const sections = [
  {
    title: 'Operations',
    items: [
      { label: 'Preventive Maintenance', href: '/preventive-maintenance', icon: Calendar, color: 'text-blue-600 bg-blue-50' },
      { label: 'Meters', href: '/meters', icon: Gauge, color: 'text-purple-600 bg-purple-50' },
      { label: 'Inventory', href: '/inventory', icon: Box, color: 'text-amber-600 bg-amber-50' },
      { label: 'Requests', href: '/requests', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Scan Code', href: '/scan', icon: QrCode, color: 'text-slate-600 bg-slate-100' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
      { label: 'Maintenance Reports', href: '/reports/maintenance', icon: FileText, color: 'text-cyan-600 bg-cyan-50' },
      { label: 'Sites', href: '/sites', icon: MapPin, color: 'text-rose-600 bg-rose-50' },
    ],
  },
]

const adminItems = [
  { label: 'Teams / Users', href: '/teams', icon: Users, color: 'text-blue-600 bg-blue-50' },
  { label: 'Custom Roles', href: '/settings/roles', icon: Shield, color: 'text-purple-600 bg-purple-50' },
  { label: 'Audit Log', href: '/audit-log', icon: Shield, color: 'text-slate-600 bg-slate-100' },
  { label: 'Import Data', href: '/import', icon: Upload, color: 'text-amber-600 bg-amber-50' },
  { label: 'Settings', href: '/settings', icon: Settings, color: 'text-slate-600 bg-slate-100' },
]

export default function MoreScreen({ userRole }: Props) {
  const showAdmin = userRole === 'ADMIN' || userRole === 'MANAGER'

  return (
    <div className="p-5 pb-28 space-y-5">
      <h1 className="text-lg font-bold text-slate-900">More</h1>

      {sections.map(section => (
        <div key={section.title} className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{section.title}</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {section.items.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="flex-1 text-sm font-semibold text-slate-800">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      {showAdmin && (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Administration</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {adminItems.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="flex-1 text-sm font-semibold text-slate-800">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/profile"
        className="flex items-center gap-3 bg-white rounded-xl border border-slate-200/80 px-4 py-3 active:bg-slate-50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Settings className="w-4 h-4 text-slate-500" />
        </div>
        <span className="flex-1 text-sm font-semibold text-slate-800">Account & Profile</span>
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </Link>
    </div>
  )
}
