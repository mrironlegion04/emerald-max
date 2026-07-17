'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  Building2, ClipboardList, Clock, CheckCircle, AlertTriangle,
  DollarSign, Wrench, CalendarClock, ChevronDown,
} from 'lucide-react'
import Badge, { workOrderStatusVariant, priorityVariant } from './Badge'

interface DashboardData {
  range: { start: string; end: string; preset: string }
  kpis: {
    totalWOs: number; completedWOs: number; closedWOs: number; openWOs: number; inProgressWOs: number
    onHoldWOs: number; cancelledWOs: number; overdueWOs: number
    totalLaborCost: number; totalPartsCost: number
  }
  onTimeOverdue: { onTime: number; overdue: number }
  byType: { type: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  createdVsCompleted: { period: string; created: number; completed: number }[]
  assets: { total: number; byStatus: { status: string; count: number }[]; avgMttrMinutes: number; totalFailures: number; totalDowntimeMinutes: number }
  pm: { overdue: number; dueSoon: number }
  topAssignees: { name: string; count: number }[]
}

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
]

const TYPE_LABELS: Record<string, string> = {
  BREAKDOWN: 'Reactive', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}
const TYPE_COLORS: Record<string, string> = {
  BREAKDOWN: '#f97316', PREVENTIVE: '#3b82f6', PREDICTIVE: '#a855f7',
}
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#3b82f6', LOW: '#94a3b8',
}
const ASSET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e', INACTIVE: '#94a3b8', UNDER_MAINTENANCE: '#f59e0b', DECOMMISSIONED: '#ef4444',
}

function formatCost(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500 capitalize">{p.dataKey}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function DashboardOverview({ userName }: { userName: string }) {
  const [preset, setPreset] = useState('this_month')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPresetDrop, setShowPresetDrop] = useState(false)

  const fetchData = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/stats?preset=${p}`)
      const d = await res.json()
      setData(d)
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(preset) }, [preset, fetchData])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const presetLabel = PRESETS.find(p => p.value === preset)?.label ?? 'This Month'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {userName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here&apos;s your maintenance overview</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowPresetDrop(!showPresetDrop)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <CalendarClock className="w-4 h-4 text-slate-400" />
            {presetLabel}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {showPresetDrop && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPresetDrop(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1 overflow-hidden">
                {PRESETS.map(p => (
                  <button key={p.value}
                    onClick={() => { setPreset(p.value); setShowPresetDrop(false) }}
                    className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
                      preset === p.value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="py-24 text-center text-sm font-semibold text-slate-400">Loading dashboard…</div>
      ) : data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            <KPICard icon={<ClipboardList className="w-4.5 h-4.5" />} label="Total WOs" value={data.kpis.totalWOs} color="blue" />
            <KPICard icon={<CheckCircle className="w-4.5 h-4.5" />} label="Completed" value={data.kpis.completedWOs} color="green" />
            <KPICard icon={<CheckCircle className="w-4.5 h-4.5" />} label="Closed" value={data.kpis.closedWOs} color="green" />
            <KPICard icon={<Wrench className="w-4.5 h-4.5" />} label="Open" value={data.kpis.openWOs + data.kpis.inProgressWOs} color="yellow" subtitle={`${data.kpis.inProgressWOs} in progress`} />
            <KPICard icon={<AlertTriangle className="w-4.5 h-4.5" />} label="Overdue" value={data.kpis.overdueWOs} color={data.kpis.overdueWOs > 0 ? 'red' : 'green'} />
            <KPICard icon={<DollarSign className="w-4.5 h-4.5" />} label="Total Cost" value={formatCost(data.kpis.totalLaborCost + data.kpis.totalPartsCost)} color="purple" subtitle={`Labor ${formatCost(data.kpis.totalLaborCost)}`} />
            <KPICard icon={<Clock className="w-4.5 h-4.5" />} label="PM Alerts" value={data.pm.overdue + data.pm.dueSoon} color={data.pm.overdue > 0 ? 'red' : 'green'} subtitle={`${data.pm.overdue} overdue`} />
          </div>

          {/* Charts Row 1: Created vs Completed + On Time vs Overdue */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Created vs Completed - line chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Created vs Completed</h3>
              {data.createdVsCompleted.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.createdVsCompleted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Created" />
                    <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Completed" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* On Time vs Overdue - donut */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-bold text-slate-900 mb-4">On Time vs Overdue</h3>
              {data.onTimeOverdue.onTime + data.onTimeOverdue.overdue === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">No WOs with due dates</div>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'On Time', value: data.onTimeOverdue.onTime },
                          { name: 'Overdue', value: data.onTimeOverdue.overdue },
                        ]}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                        dataKey="value" paddingAngle={2} strokeWidth={0}>
                        <Cell fill="#22c55e" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />On Time</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Overdue</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 mt-2">
                    {data.onTimeOverdue.onTime + data.onTimeOverdue.overdue > 0
                      ? Math.round((data.onTimeOverdue.onTime / (data.onTimeOverdue.onTime + data.onTimeOverdue.overdue)) * 100)
                      : 0}% on time
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2: WO by Type + WO by Priority + Top Assignees */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* WO by Type - bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Work Orders by Type</h3>
              {data.byType.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">No WOs in range</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.byType.map(t => ({ name: TYPE_LABELS[t.type] ?? t.type, count: t.count }))}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Work Orders">
                      {data.byType.map((t, i) => (
                        <Cell key={i} fill={TYPE_COLORS[t.type] ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* WO by Priority - pie */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Work Orders by Priority</h3>
              {data.byPriority.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">No WOs in range</div>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.byPriority.map(p => ({ name: p.priority, value: p.count }))}
                        cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={1} strokeWidth={0}>
                        {data.byPriority.map((p, i) => (
                          <Cell key={i} fill={PRIORITY_COLORS[p.priority] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs justify-center">
                    {data.byPriority.map(p => (
                      <span key={p.priority} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[p.priority] }} />
                        {p.priority}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Assignees */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Top Performers</h3>
              {data.topAssignees.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">No completions in range</div>
              ) : (
                <div className="space-y-3">
                  {data.topAssignees.map((a, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{a.name}</p>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(a.count / (data.topAssignees[0]?.count ?? 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{a.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Asset Health */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Asset Health</h3>
              <Link href="/assets" className="text-xs text-blue-600 hover:underline font-medium">View all</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {data.assets.byStatus.map(s => (
                <div key={s.status} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: `${ASSET_STATUS_COLORS[s.status] ?? '#94a3b8'}15` }}>
                    <Building2 className="w-4 h-4" style={{ color: ASSET_STATUS_COLORS[s.status] ?? '#94a3b8' }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 leading-none">{s.count}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{s.status.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
            {(data.assets.avgMttrMinutes > 0 || data.assets.totalFailures > 0) && (
              <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100">
                {data.assets.avgMttrMinutes > 0 && (
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold">MTTR</span>
                    <span className="ml-2 font-bold text-slate-800">{Math.round(data.assets.avgMttrMinutes)} min</span>
                  </div>
                )}
                {data.assets.totalFailures > 0 && (
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold">Total Failures</span>
                    <span className="ml-2 font-bold text-slate-800">{data.assets.totalFailures}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KPICard({ icon, label, value, color, subtitle }: {
  icon: React.ReactNode; label: string; value: string | number
  color: string; subtitle?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600', gray: 'bg-slate-100 text-slate-500',
  }
  const valColor: Record<string, string> = {
    blue: 'text-blue-700', green: 'text-emerald-700', yellow: 'text-amber-700',
    red: 'text-rose-700', purple: 'text-purple-700', gray: 'text-slate-700',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] hover:border-slate-300 transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color] ?? colorMap.blue}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
      {subtitle && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
    </div>
  )
}
