'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  ClipboardList,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Users,
  Package,
  TrendingUp,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface KPIs {
  totalWOs: number; completedWOs: number; overdueCount: number
  pmCompliance: number; totalCost: number; totalLaborCost: number
  totalPartsCost: number; totalLaborHours: number; avgCostPerWO: number
}
interface MonthWO    { month: string; created: number; completed: number; open: number }
interface MonthCost  { month: string; labor: number; parts: number; total: number }
interface CompRate   { month: string; rate: number; total: number }
interface StatusCount   { status: string;   count: number }
interface TypeCount     { type: string;     count: number }
interface PriorityCount { priority: string; count: number }
interface TopAsset   { id: string; name: string; code: string; count: number; cost: number; hours: number }
interface OverdueWO  { id: string; woNumber: string; title: string; status: string; dueDate: string | null; assetName: string | null; assignedTo: string | null; daysOverdue: number }
interface LowPart    { id: string; name: string; partNumber: string; quantity: number; minQuantity: number; unit: string }

interface ReportData {
  kpis: KPIs
  woByMonth: MonthWO[]; costByMonth: MonthCost[]; completionRate: CompRate[]
  statusCounts: StatusCount[]; typeCounts: TypeCount[]; priorityCounts: PriorityCount[]
  topAssets: TopAsset[]; overdueWOs: OverdueWO[]; lowStockParts: LowPart[]; months: number
}

// ── Colours ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string,string> = {
  OPEN:'#3b82f6', IN_PROGRESS:'#f59e0b', ON_HOLD:'#f97316',
  COMPLETED:'#22c55e', CANCELLED:'#9ca3af',
}
const TYPE_COLORS  = ['#6366f1','#14b8a6','#f59e0b','#ef4444']
const PRIORITY_COLORS: Record<string,string> = {
  LOW:'#9ca3af', MEDIUM:'#3b82f6', HIGH:'#f97316', CRITICAL:'#ef4444',
}
const BAR_LABOR  = '#6366f1'
const BAR_PARTS  = '#14b8a6'
const LINE_COMP  = '#22c55e'
const LINE_CREAT = '#6366f1'

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits: 0 }).format(v)
}
function fmt(date: string | null) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(new Date(date))
}

const STATUS_LABELS: Record<string,string> = {
  OPEN:'Open', IN_PROGRESS:'In Progress', ON_HOLD:'On Hold', COMPLETED:'Completed', CANCELLED:'Cancelled',
}
const TYPE_LABELS: Record<string,string> = {
  BREAKDOWN:'Breakdown', PREVENTIVE:'Preventive', PREDICTIVE:'Predictive',
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KPICard({ title, value, sub, color = 'blue' }: { title: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, { bg: string; text: string; value: string; border: string }> = {
    blue: { bg: 'bg-blue-50/70', border: 'border-blue-100/40', text: 'text-blue-600', value: 'text-blue-700' },
    green: { bg: 'bg-emerald-50/70', border: 'border-emerald-100/40', text: 'text-emerald-600', value: 'text-emerald-700' },
    red: { bg: 'bg-rose-50/70', border: 'border-rose-100/40', text: 'text-rose-600', value: 'text-rose-700' },
    purple: { bg: 'bg-purple-50/70', border: 'border-purple-100/40', text: 'text-purple-600', value: 'text-purple-700' },
    yellow: { bg: 'bg-amber-50/70', border: 'border-amber-100/40', text: 'text-amber-600', value: 'text-amber-700' },
    teal: { bg: 'bg-teal-50/70', border: 'border-teal-100/40', text: 'text-teal-600', value: 'text-teal-700' },
  }
  const c = colors[color] || colors.blue;
  return (
    <div className="stat-card flex items-start gap-3 sm:gap-4 p-4 sm:p-5">
      <div className={`w-10 h-10 border rounded-xl flex items-center justify-center flex-shrink-0 shadow-3xs ${c.bg} ${c.border}`}>
        {title.toLowerCase().includes('total work') && <ClipboardList className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('completed') && <CheckSquare className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('overdue') && <AlertTriangle className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('compliance') && <CheckCircle2 className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('total cost') && <DollarSign className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('labor cost') && <Users className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('parts cost') && <Package className={`w-5 h-5 ${c.text}`} />}
        {title.toLowerCase().includes('avg cost') && <TrendingUp className={`w-5 h-5 ${c.text}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider truncate" title={title}>{title}</p>
        <p className={`text-lg sm:text-2xl font-bold tracking-tight mt-0.5 leading-none ${c.value}`}>{value}</p>
        {sub && <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-1 truncate" title={sub}>{sub}</p>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 text-sm mb-4">{title}</h2>
      {children}
    </div>
  )
}

// Custom tooltip for recharts
function ChartTooltip({ active, payload, label, currency = false }: {
  active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string; currency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {currency ? fmtCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportsDashboard({ userRole }: { userRole: string }) {
  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [months,  setMonths]  = useState(6)

  const load = useCallback(async (m: number) => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/reports?months=${m}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      setData(json)
    } catch { setError('Failed to load report data') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { load(months) }, [months, load])

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">{error}</div>
  )

  if (loading || !data) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 animate-pulse">
      {Array.from({length: 8}).map((_, i) => (
        <div key={i} className="stat-card h-24 bg-gray-100/60 rounded-2xl border-dashed" />
      ))}
    </div>
  )

  const { kpis, woByMonth, costByMonth, completionRate, statusCounts, typeCounts,
    priorityCounts, topAssets, overdueWOs, lowStockParts } = data

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200/90 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Analysis Window</span>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto shadow-inner border border-slate-150">
          {[3, 6, 12].map(m => (
            <button key={m} onClick={() => setMonths(m)}
              className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                months === m 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}>
              {m} Months
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        <KPICard title="Total work orders"  value={kpis.totalWOs}
          sub={`last ${months} months`} color="blue" />
        <KPICard title="Completed"          value={kpis.completedWOs}
          sub={kpis.totalWOs > 0 ? `${Math.round(kpis.completedWOs/kpis.totalWOs*100)}% completion rate` : '—'}
          color="green" />
        <KPICard title="Overdue WOs"        value={kpis.overdueCount}
          sub="currently open past due" color={kpis.overdueCount > 0 ? 'red' : 'green'} />
        <KPICard title="PM compliance"      value={`${kpis.pmCompliance}%`}
          sub="of active schedules on time" color={kpis.pmCompliance >= 80 ? 'green' : kpis.pmCompliance >= 60 ? 'yellow' : 'red'} />
        <KPICard title="Total cost"         value={fmtCurrency(kpis.totalCost)}
          sub={`labor + parts`} color="purple" />
        <KPICard title="Labor cost"         value={fmtCurrency(kpis.totalLaborCost)}
          sub={`${kpis.totalLaborHours}h logged`} color="teal" />
        <KPICard title="Parts cost"         value={fmtCurrency(kpis.totalPartsCost)}
          sub="from inventory" color="teal" />
        <KPICard title="Avg cost / WO"      value={fmtCurrency(kpis.avgCostPerWO)}
          sub="completed work orders" color="purple" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Work orders created vs completed">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={woByMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="created"   name="Created"   fill={LINE_CREAT} radius={[3,3,0,0]} />
              <Bar dataKey="completed" name="Completed" fill={LINE_COMP}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Monthly maintenance cost">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={costByMonth} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? `${Math.round(v/1000)}k` : v}`} />
              <Tooltip content={<ChartTooltip currency />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="labor" name="Labor"  fill={BAR_LABOR} radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="parts" name="Parts"  fill={BAR_PARTS} radius={[3,3,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Completion rate by month">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completionRate} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: any) => [`${v}%`, 'Rate']} labelFormatter={l => l} />
              <Line type="monotone" dataKey="rate" name="Rate" stroke={LINE_COMP}
                strokeWidth={2} dot={{ r: 3, fill: LINE_COMP }} />
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Work orders by status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusCounts} dataKey="count" nameKey="status"
                cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                {statusCounts.map((s, i) => (
                  <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, name: any) => [v, STATUS_LABELS[name] ?? name]} />
              <Legend formatter={(v: string) => STATUS_LABELS[v] ?? v} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Work orders by type">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={typeCounts} dataKey="count" nameKey="type"
                cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                {typeCounts.map((_, i) => (
                  <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, name: any) => [v, TYPE_LABELS[name] ?? name]} />
              <Legend formatter={(v: string) => TYPE_LABELS[v] ?? v} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Top assets */}
      <Section title={`Assets with highest maintenance costs (last ${months} months)`}>
        {topAssets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No cost data available yet</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topAssets.slice(0, 6)}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  tickFormatter={v => `$${v >= 1000 ? `${Math.round(v/1000)}k` : v}`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [fmtCurrency(Number(v)), 'Total cost']} />
                <Bar dataKey="cost" name="Total cost" fill={BAR_LABOR} radius={[0,3,3,0]}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Table below chart */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Asset</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">WOs</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Labor hrs</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Total cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topAssets.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Link href={`/assets/${a.id}`} className="text-blue-600 hover:underline font-medium">
                          {a.name}
                        </Link>
                        <span className="text-gray-400 ml-1">({a.code})</span>
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">{a.count}</td>
                      <td className="py-2 px-2 text-right text-gray-700">{a.hours}h</td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">{fmtCurrency(a.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* Priority breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Work orders by priority">
          <div className="space-y-2">
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(p => {
              const item  = priorityCounts.find(x => x.priority === p)
              const count = item?.count ?? 0
              const total = priorityCounts.reduce((s, x) => s + x.count, 0)
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 w-16">{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: PRIORITY_COLORS[p] }} />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </Section>

        {/* PM compliance detail */}
        <Section title="PM schedule Adherence">
          <div className="flex items-center justify-center py-4">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-36 h-36 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={kpis.pmCompliance >= 80 ? '#22c55e' : kpis.pmCompliance >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${kpis.pmCompliance} ${100 - kpis.pmCompliance}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${kpis.pmCompliance >= 80 ? 'text-green-600' : kpis.pmCompliance >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {kpis.pmCompliance}%
                </span>
                <span className="text-xs text-gray-400">compliant</span>
              </div>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-bold text-green-600">{100 - (100 - kpis.pmCompliance)}%</span> of PM schedules are on track
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-red-600">{100 - kpis.pmCompliance}%</span> are overdue
              </p>
              <Link href="/preventive-maintenance" className="text-xs text-blue-600 hover:underline block mt-2">
                View PM schedules →
              </Link>
            </div>
          </div>
        </Section>
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-1 gap-6">
        {/* Overdue WOs table */}
        <Section title={`Overdue work orders (${overdueWOs.length})`}>
          {overdueWOs.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">No overdue work orders</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {overdueWOs.map(wo => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 transition-colors -mx-1 px-1 rounded">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                    <p className="text-xs text-gray-400">
                      {wo.woNumber}{wo.assetName ? ` · ${wo.assetName}` : ''}{wo.assignedTo ? ` · ${wo.assignedTo}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-red-600">{wo.daysOverdue}d overdue</p>
                    <p className="text-xs text-gray-400">{fmt(wo.dueDate)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
