'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { LayoutList, Table, Calendar } from 'lucide-react'
import WorkOrdersTable from './WorkOrdersTable'
import WorkOrderPanelView from './WorkOrderPanelView'
import CalendarView from './CalendarView'

export type WOView = 'panel' | 'table' | 'calendar'
const STORAGE_KEY = 'wo-view-preference'
const VALID_VIEWS: WOView[] = ['panel', 'table', 'calendar']

// The view preference lives in localStorage. A tiny external store lets React
// read it without calling setState in an effect and without reading
// localStorage during the server render (which would mismatch hydration).
const viewPrefStore = {
  get(): WOView {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as WOView | null
      if (stored && VALID_VIEWS.includes(stored)) return stored
    } catch { /* empty */ }
    return 'panel'
  },
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  },
  set(view: WOView) {
    try {
      localStorage.setItem(STORAGE_KEY, view)
    } catch { /* empty */ }
    this.listeners.forEach((listener) => listener())
  },
}

function subscribeViewPref(listener: () => void) {
  return viewPrefStore.subscribe(listener)
}

function getClientSnapshot(): WOView {
  return viewPrefStore.get()
}

function getServerSnapshot(): WOView {
  return 'panel'
}

interface Props {
  panelData?: any
  tableData: any[]
  technicians: any[]
  typeLabels: Record<string, string>
  statusLabels: Record<string, string>
  totalPages: number
  currentPage: string
  baseUrl: string
  userRole?: string
  userId?: string
  children?: ReactNode
}

const views: { id: WOView; label: string; icon: typeof LayoutList }[] = [
  { id: 'panel',   label: 'To-Do View',     icon: LayoutList },
  { id: 'table',   label: 'Table View',     icon: Table },
  { id: 'calendar', label: 'Calendar View', icon: Calendar },
]

export default function WorkOrderViewShell({
  panelData, tableData, technicians, typeLabels, statusLabels, totalPages, currentPage, baseUrl, userRole, userId, children,
}: Props) {
  const view = useSyncExternalStore(subscribeViewPref, getClientSnapshot, getServerSnapshot)

  function switchView(v: WOView) {
    viewPrefStore.set(v)
  }

  return (
    <div className="space-y-4">
      {/* View Switcher Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-slate-100/80 rounded-xl p-1 border border-slate-200/60">
          {views.map(v => {
            const Icon = v.icon
            const active = view === v.id
            return (
              <button
                key={v.id}
                onClick={() => switchView(v.id)}
                title={v.label}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  active
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      {children}

      {/* View Content */}
      {view === 'panel' && panelData && (
        <WorkOrderPanelView grouped={panelData} userRole={userRole} userId={userId} />
      )}

      {view === 'panel' && !panelData && (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">
          Loading panel view...
        </div>
      )}

      {view === 'table' && (
        <>
          <WorkOrdersTable
            workOrders={tableData}
            technicians={technicians}
            typeLabels={typeLabels}
            statusLabels={statusLabels}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                {parseInt(currentPage) > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=1'} className="btn-secondary text-sm">← First</Link>
                )}
                {parseInt(currentPage) > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${parseInt(currentPage) - 1}`} className="btn-secondary text-sm">← Previous</Link>
                )}
                {parseInt(currentPage) < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${parseInt(currentPage) + 1}`} className="btn-secondary text-sm">Next →</Link>
                )}
                {parseInt(currentPage) < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${totalPages}`} className="btn-secondary text-sm">Last →</Link>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'calendar' && (
        <CalendarView />
      )}
    </div>
  )
}
