'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import {
  CheckCircle2, Clock, AlertCircle, Inbox, UserCircle2, Users,
  CalendarDays, Package, ArrowRight, Loader2,
} from 'lucide-react'
import Badge from './Badge'
import WorkOrderDetailPane from './WorkOrderDetailPane'
import { WO_STATUS_LABELS, WO_STATUS_VARIANTS } from '@/lib/work-order-status'

export interface WOListItem {
  id: string
  woNumber: string
  title: string
  type: string
  status: string
  priority: string
  dueDate: Date | string | null
  asset: { id: string; name: string; assetCode: string | null } | null
  assignedTo: { id: string; name: string } | null
  domain: { id: string; name: string } | null
  createdBy: { name: string } | null
}

interface GroupedWOs {
  myWOs: WOListItem[]
  mySubtasks: any[]
  teamWOs: WOListItem[]
  teamSubtasks: any[]
  createdWOs: WOListItem[]
  allOpen: WOListItem[]
  done: WOListItem[]
  totalCount: number
}

const statusLabels = WO_STATUS_LABELS
const typeLabels: Record<string, string> = {
  BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}

const statusVariant = (s: string): 'yellow' | 'blue' | 'orange' | 'green' | 'gray' =>
  (WO_STATUS_VARIANTS[s] as never) ?? 'gray'
const priorityVariant = (p: string): 'red' | 'orange' | 'yellow' | 'blue' | 'gray' =>
  ({ CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'yellow', LOW: 'blue' }[p] as never) ?? 'gray'

function getUrgencyBucket(dueDate: Date | string | null): 'overdue' | 'today' | 'thisWeek' | 'later' | 'none' {
  if (!dueDate) return 'none'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
  const d = new Date(dueDate)
  const norm = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (norm < today) return 'overdue'
  if (norm.getTime() === today.getTime()) return 'today'
  if (norm <= weekEnd) return 'thisWeek'
  return 'later'
}

function fmtDate(date: Date | string | null) {
  if (!date) return 'No due date'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

type Tab = 'todo' | 'done'
type SubTab = 'all' | 'mine' | 'team' | 'pool' | 'created'

const URGENCY_CONFIG: Record<string, { label: string; dot: string }> = {
  overdue:  { label: 'Overdue',     dot: 'bg-red-500' },
  today:    { label: 'Due Today',   dot: 'bg-orange-500' },
  thisWeek: { label: 'This Week',   dot: 'bg-yellow-500' },
  later:    { label: 'Later',       dot: 'bg-blue-400' },
  none:     { label: 'No Due Date', dot: 'bg-gray-300' },
}

function WOCardMini({ wo, isSelected, onClick }: { wo: WOListItem; isSelected: boolean; onClick: () => void }) {
  const bucket = getUrgencyBucket(wo.dueDate)
  const isOverdue = bucket === 'overdue'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left group p-3 rounded-xl border transition-all duration-150 ${
        isSelected
          ? 'border-blue-400 bg-blue-50/80 shadow-sm ring-1 ring-blue-200/50'
          : 'border-transparent hover:border-slate-200 hover:bg-white hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-mono text-slate-400 font-bold">{wo.woNumber}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
          <Badge label={statusLabels[wo.status] ?? wo.status} variant={statusVariant(wo.status)} />
        </div>
      </div>
      <p className={`text-sm font-semibold leading-snug line-clamp-2 transition-colors ${
        isSelected ? 'text-blue-800' : 'text-slate-800 group-hover:text-blue-700'
      }`}>
        {wo.title}
      </p>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-medium">
        {wo.asset && (
          <span className="flex items-center gap-1 truncate">
            <Package className="w-3 h-3 shrink-0" /> {wo.asset.name}
          </span>
        )}
        {wo.assignedTo && (
          <span className="flex items-center gap-1 truncate">
            <UserCircle2 className="w-3 h-3 shrink-0" /> {wo.assignedTo.name}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${
          isOverdue ? 'text-red-500' : 'text-slate-400'
        }`}>
          <CalendarDays className="w-3 h-3" />
          {fmtDate(wo.dueDate)}
        </span>
        {isOverdue && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
            OVERDUE
          </span>
        )}
      </div>
    </button>
  )
}

function SubtaskCardMini({ st, isSelected, onClick }: { st: any; isSelected: boolean; onClick: () => void }) {
  const effectiveDue = st.dueDate ?? st.workOrder?.dueDate
  const isOverdue = getUrgencyBucket(effectiveDue) === 'overdue'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left group p-3 rounded-xl border transition-all duration-150 ${
        isSelected
          ? 'border-violet-400 bg-violet-50/80 shadow-sm ring-1 ring-violet-200/50'
          : 'border-transparent hover:border-slate-200 hover:bg-white hover:shadow-xs'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">Subtask</span>
        <span className="text-[11px] font-mono text-slate-400 ml-auto">{st.workOrder?.woNumber}</span>
      </div>
      <p className={`text-sm font-semibold leading-snug line-clamp-2 transition-colors ${
        isSelected ? 'text-violet-800' : 'text-slate-800 group-hover:text-violet-700'
      }`}>
        {st.title}
      </p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${
          isOverdue ? 'text-red-500' : 'text-slate-400'
        }`}>
          <CalendarDays className="w-3 h-3" />
          {fmtDate(effectiveDue)}
        </span>
        {isOverdue && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
            OVERDUE
          </span>
        )}
      </div>
    </button>
  )
}

export default function WorkOrderPanelView({ grouped, userRole = 'TECHNICIAN', userId = '' }: { grouped: GroupedWOs; userRole?: string; userId?: string }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'wo' | 'subtask'>('wo')
  const [activeTab, setActiveTab] = useState<Tab>('todo')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('all')
  const [detailLoading, setDetailLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleSelect = (id: string, type: 'wo' | 'subtask' = 'wo') => {
    if (isMobile) {
      if (type === 'wo') {
        router.push(`/work-orders/${id}`)
      }
      return
    }
    setSelectedId(id)
    setSelectedType(type)
    setDetailLoading(true)
  }

  const todoSubTabs: { id: SubTab; label: string; count: number }[] = [
    { id: 'all' as SubTab,     label: 'All Open',   count: grouped.allOpen.length },
    { id: 'mine' as SubTab,    label: 'Assigned to Me', count: grouped.myWOs.length },
    { id: 'team' as SubTab,    label: 'My Team',    count: grouped.teamWOs.length },
    { id: 'created' as SubTab, label: 'Created by Me', count: grouped.createdWOs.length },
    { id: 'pool' as SubTab,    label: 'Open Pool',  count: grouped.allOpen.filter(wo => !wo.assignedTo && !wo.domain).length },
  ].filter(t => t.count > 0 || t.id === 'all')

  const getVisibleWOs = (): WOListItem[] => {
    if (activeSubTab === 'mine')    return grouped.myWOs
    if (activeSubTab === 'team')    return grouped.teamWOs
    if (activeSubTab === 'created') return grouped.createdWOs
    if (activeSubTab === 'pool')    return grouped.allOpen.filter(wo => !wo.assignedTo && !wo.domain)
    return grouped.allOpen
  }

  const visibleWOs = activeTab === 'todo' ? getVisibleWOs() : grouped.done

  const overdueCount = visibleWOs.filter(
    wo => wo.dueDate && new Date(wo.dueDate) < new Date() && !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(wo.status)
  ).length

  return (
    <div className="flex h-[calc(100vh-12rem)] border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* LEFT PANE - List */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col border-r border-slate-200/80 bg-slate-50/30 flex-shrink-0">
        {/* Tabs: To Do / Done */}
        <div className="flex border-b border-slate-200/80 bg-white">
          <button
            onClick={() => setActiveTab('todo')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'todo'
                ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            To Do
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'todo' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {grouped.myWOs.length + grouped.teamWOs.length + grouped.allOpen.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('done')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'done'
                ? 'border-green-600 text-green-600 bg-green-50/30'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Done
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'done' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {grouped.done.length}
            </span>
          </button>
        </div>

        {/* Sub-tabs for To Do */}
        {activeTab === 'todo' && (
          <div className="flex gap-1 px-2 py-2 border-b border-slate-100 overflow-x-auto scrollbar-none">
            {todoSubTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id)}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeSubTab === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {t.label}
                <span className="ml-1 opacity-70">({t.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* WO List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {overdueCount > 0 && activeTab === 'todo' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50/80 border border-red-100 rounded-xl mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-[11px] font-bold text-red-600">
                {overdueCount} overdue work order{overdueCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {activeTab === 'todo' && activeSubTab === 'all' && (
            <>
              {grouped.myWOs.length > 0 && (
                <WOGroup
                  icon={<UserCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                  label="Assigned to Me"
                  count={grouped.myWOs.length}
                  items={grouped.myWOs}
                  selectedId={selectedId}
                  onSelect={id => handleSelect(id)}
                />
              )}
              {grouped.teamWOs.length > 0 && (
                <WOGroup
                  icon={<Users className="w-3.5 h-3.5 text-violet-500" />}
                  label="Assigned to My Team"
                  count={grouped.teamWOs.length}
                  items={grouped.teamWOs}
                  selectedId={selectedId}
                  onSelect={id => handleSelect(id)}
                />
              )}
              {grouped.createdWOs.length > 0 && (
                <WOGroup
                  icon={<Inbox className="w-3.5 h-3.5 text-amber-500" />}
                  label="Created by Me"
                  count={grouped.createdWOs.length}
                  items={grouped.createdWOs}
                  selectedId={selectedId}
                  onSelect={id => handleSelect(id)}
                />
              )}
              {(() => {
                const poolWOs = grouped.allOpen.filter(wo =>
                  !grouped.myWOs.some(m => m.id === wo.id) &&
                  !grouped.teamWOs.some(t => t.id === wo.id) &&
                  !grouped.createdWOs.some(c => c.id === wo.id)
                )
                return poolWOs.length > 0 ? (
                  <WOGroup
                    icon={<Inbox className="w-3.5 h-3.5 text-slate-400" />}
                    label="All Open Work Orders"
                    count={poolWOs.length}
                    items={poolWOs}
                    selectedId={selectedId}
                    onSelect={id => handleSelect(id)}
                  />
                ) : null
              })()}
            </>
          )}

          {activeTab === 'todo' && activeSubTab !== 'all' && (
            <div className="space-y-1">
              {visibleWOs.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="w-8 h-8 text-green-300" />}
                  title="All clear!"
                  subtitle="No work orders in this category."
                />
              ) : (
                visibleWOs.map(wo => (
                  <WOCardMini
                    key={wo.id}
                    wo={wo}
                    isSelected={selectedId === wo.id && selectedType === 'wo'}
                    onClick={() => handleSelect(wo.id)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'done' && (
            <div className="space-y-1">
              {grouped.done.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="w-8 h-8 text-green-300" />}
                  title="No completed work orders"
                  subtitle="Completed and cancelled orders appear here."
                />
              ) : (
                grouped.done.map(wo => (
                  <WOCardMini
                    key={wo.id}
                    wo={wo}
                    isSelected={selectedId === wo.id && selectedType === 'wo'}
                    onClick={() => handleSelect(wo.id)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'todo' && grouped.mySubtasks.length > 0 && activeSubTab === 'mine' && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">My Subtasks</p>
              {grouped.mySubtasks.map((st: any) => (
                <SubtaskCardMini
                  key={st.id}
                  st={st}
                  isSelected={selectedId === st.id && selectedType === 'subtask'}
                  onClick={() => handleSelect(st.id, 'subtask')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE - Detail */}
      <div className="hidden lg:flex flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {selectedId ? (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-y-auto"
            >
              <WorkOrderDetailPane
                woId={selectedType === 'wo' ? selectedId : undefined}
                subtaskId={selectedType === 'subtask' ? selectedId : undefined}
                onLoadingChange={setDetailLoading}
                userRole={userRole}
                userId={userId}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-slate-50/50 to-white"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                <ArrowRight className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-400 mb-1">Select a work order</p>
              <p className="text-xs text-slate-300 max-w-[200px]">
                Choose a work order from the list to view its details and take action.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function WOGroup({
  icon, label, count, items, selectedId, onSelect,
}: {
  icon: React.ReactNode; label: string; count: number
  items: WOListItem[]; selectedId: string | null; onSelect: (id: string) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
        {icon}
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="space-y-1">
        {items.map(wo => (
          <WOCardMini
            key={wo.id}
            wo={wo}
            isSelected={selectedId === wo.id}
            onClick={() => onSelect(wo.id)}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="py-12 text-center">
      <div className="flex justify-center mb-3 opacity-60">{icon}</div>
      <p className="font-semibold text-slate-500 text-sm">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
  )
}
