'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface CalEvent {
  id: string; type: 'wo' | 'pm'; title: string; subtitle: string
  date: string; status: string; priority: string; woType: string; href: string
  woNumber: string | null; assignee: string | null; dueDate: string | null
}

type ViewMode = 'month' | 'week'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const STATUS_ORDER: Record<string, number> = {
  OPEN: 0, IN_PROGRESS: 1, ON_HOLD: 2, COMPLETED: 3, CANCELLED: 4, SCHEDULED: 5,
}

const STATUS_DOT: Record<string, string> = {
  OPEN: 'bg-blue-500', IN_PROGRESS: 'bg-amber-500', ON_HOLD: 'bg-orange-400',
  COMPLETED: 'bg-emerald-500', CANCELLED: 'bg-slate-400', SCHEDULED: 'bg-purple-500',
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', SCHEDULED: 'Scheduled',
}

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-blue-400', LOW: 'bg-slate-400',
}

function isOverdue(ev: CalEvent): boolean {
  if (ev.type === 'pm') return false
  if (!ev.dueDate) return false
  if (ev.status === 'COMPLETED' || ev.status === 'CANCELLED') return false
  return new Date(ev.dueDate) < new Date()
}

function sortEvents(events: CalEvent[]): CalEvent[] {
  return [...events].sort((a, b) => {
    const aOverdue = isOverdue(a) ? 0 : 1
    const bOverdue = isOverdue(b) ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue
    return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  })
}

function sameDay(d1: string | Date, d2: string | Date): boolean {
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekStart(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

function formatMonthDay(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
}

const MAX_VISIBLE_MONTH = 3

export default function CalendarView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [mode, setMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  const fetchIdRef = useRef(0)

  const todayKey = dateKey(today)

  const fetchData = useCallback(async (start: Date, end: Date) => {
    const id = ++fetchIdRef.current
    setLoading(true)
    try {
      const s = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
      const e = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      const res = await fetch(`/api/calendar?startDate=${s}&endDate=${e}`)
      const data = await res.json()
      if (id === fetchIdRef.current) {
        setEvents(data.events ?? [])
        setLoading(false)
      }
    } catch {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode === 'month') {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0)
      fetchData(start, end)
    } else {
      const end = addDays(weekStart, 6)
      fetchData(weekStart, end)
    }
  }, [mode, year, month, weekStart, fetchData])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelected(null)
  }
  function prevWeek() {
    setWeekStart(ws => addDays(ws, -7))
    setSelected(null)
  }
  function nextWeek() {
    setWeekStart(ws => addDays(ws, 7))
    setSelected(null)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
    setWeekStart(getWeekStart(today))
    setSelected(null)
  }

  function eventsForDay(d: Date): CalEvent[] {
    return sortEvents(events.filter(e => sameDay(e.date, d)))
  }

  function hasOverdue(d: Date): boolean {
    return eventsForDay(d).some(e => isOverdue(e))
  }

  const selectedDayEvents = selected
    ? eventsForDay(new Date(selected + 'T12:00:00'))
    : []

  // Month grid
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthGrid: (number | null)[] = [
    ...Array(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (monthGrid.length % 7 !== 0) monthGrid.push(null)

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={mode === 'month' ? prevMonth : prevWeek}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold text-slate-900 min-w-44 text-center">
            {mode === 'month'
              ? `${MONTHS[month - 1]} ${year}`
              : `${formatMonthDay(weekDays[0])} – ${formatMonthDay(weekDays[6])}, ${weekDays[6].getFullYear()}`
            }
          </h2>
          <button onClick={mode === 'month' ? nextMonth : nextWeek}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Today
          </button>
          <div className="flex bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/60">
            {(['month', 'week'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {m === 'month' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />Open</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />In Progress</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />On Hold</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />PM Due</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-red-50 flex-shrink-0 border border-red-200" />Overdue day
        </span>
      </div>

      <div className="flex gap-5">
        {/* Calendar body */}
        <div className={`flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden ${selected ? 'lg:flex-1' : ''}`}>
          {mode === 'month' ? (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                ))}
              </div>

              {loading ? (
                <div className="py-24 text-center text-sm font-semibold text-slate-400">Loading work orders…</div>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 border-l border-transparent select-none">
                  {monthGrid.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="min-h-20 bg-slate-50/20" />
                    const dk = dateKey(new Date(year, month - 1, day))
                    const dayEvts = eventsForDay(new Date(year, month - 1, day))
                    const isToday = dk === todayKey
                    const isSel = dk === selected
                    const overdueDay = hasOverdue(new Date(year, month - 1, day))

                    return (
                      <div key={dk}
                        onClick={() => setSelected(isSel ? null : dk)}
                        className={`min-h-20 p-1.5 cursor-pointer transition-all hover:bg-slate-50/60 ${
                          isSel ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-400/50' :
                          overdueDay ? 'bg-red-50/30' :
                          isToday ? 'bg-amber-50/30' : ''
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold w-5.5 h-5.5 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-blue-600 text-white' : 'text-slate-700'
                          }`}>{day}</span>
                          {overdueDay && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          )}
                        </div>

                        <div className="space-y-0.5">
                          {dayEvts.slice(0, MAX_VISIBLE_MONTH).map(ev => (
                            <WOItem key={ev.id} ev={ev} compact />
                          ))}
                          {dayEvts.length > MAX_VISIBLE_MONTH && (
                            <button onClick={(e) => { e.stopPropagation(); setSelected(dk) }}
                              className="text-[9px] font-bold text-blue-500 hover:text-blue-700 pl-1 transition-colors">
                              +{dayEvts.length - MAX_VISIBLE_MONTH} more
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Week view */}
              <div className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100">
                {weekDays.map(d => {
                  const dk = dateKey(d)
                  const isToday = dk === todayKey
                  const overdueDay = hasOverdue(d)
                  return (
                    <div key={dk} className={`py-2.5 text-center ${overdueDay ? 'bg-red-50/40' : isToday ? 'bg-blue-50/40' : 'bg-slate-50/20'}`}>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </div>
                      <div className={`text-sm font-bold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-600 text-white' : 'text-slate-800'
                      }`}>
                        {d.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {loading ? (
                <div className="py-24 text-center text-sm font-semibold text-slate-400">Loading work orders…</div>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[28rem]">
                  {weekDays.map(d => {
                    const dk = dateKey(d)
                    const dayEvts = eventsForDay(d)
                    const isSel = dk === selected
                    const overdueDay = hasOverdue(d)

                    return (
                      <div key={dk}
                        onClick={() => setSelected(isSel ? null : dk)}
                        className={`p-1.5 cursor-pointer transition-all hover:bg-slate-50/40 ${
                          isSel ? 'bg-blue-50/40 ring-2 ring-inset ring-blue-400/40' :
                          overdueDay ? 'bg-red-50/20' : ''
                        }`}>
                        <div className="space-y-1">
                          {dayEvts.length === 0 && (
                            <div className="text-[10px] text-slate-300 font-medium text-center py-4">No WOs</div>
                          )}
                          {dayEvts.map(ev => (
                            <WOItem key={ev.id} ev={ev} compact={false} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Side panel */}
        {selected && (
          <div className="hidden lg:flex w-72 flex-shrink-0 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] flex-col max-h-[36rem]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(selected + 'T12:00:00'))}
              </h3>
              <button onClick={() => setSelected(null)} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {selectedDayEvents.length === 0 ? (
              <div className="py-10 text-center text-xs font-medium text-slate-400">No work orders for this day.</div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto flex-1">
                {selectedDayEvents.map(ev => (
                  <WOItem key={ev.id} ev={ev} compact={false} showDetails />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function WOItem({ ev, compact, showDetails }: { ev: CalEvent; compact?: boolean; showDetails?: boolean }) {
  const overdue = isOverdue(ev)
  const dotColor = ev.type === 'pm' ? 'bg-purple-500' : (STATUS_DOT[ev.status] ?? 'bg-slate-400')
  const prioColor = PRIORITY_DOT[ev.priority] ?? 'bg-slate-400'

  const tooltip = [
    ev.woNumber && `${ev.woNumber}`,
    ev.title,
    `${STATUS_LABEL[ev.status] ?? ev.status}${overdue ? ' (Overdue)' : ''}`,
    ev.assignee ? `Assigned: ${ev.assignee}` : 'Unassigned',
    ev.dueDate ? `Due: ${new Date(ev.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}` : null,
  ].filter(Boolean).join(' · ')

  if (compact) {
    return (
      <Link href={ev.href} title={tooltip}
        onClick={e => e.stopPropagation()}
        className={`flex items-center gap-1 px-1 py-[3px] rounded transition-all hover:bg-white/80 group ${
          overdue ? 'border-l-2 border-red-400' : ''
        }`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className="text-[10px] font-semibold text-slate-700 truncate leading-tight group-hover:text-slate-900">{ev.title}</span>
      </Link>
    )
  }

  return (
    <Link href={ev.href} title={tooltip}
      onClick={e => e.stopPropagation()}
      className={`block p-2 rounded-lg border transition-all hover:shadow-sm group ${
        overdue ? 'border-red-200/60 bg-red-50/30 hover:bg-red-50/50' :
        'border-slate-150 bg-white hover:border-slate-250'
      }`}>
      <div className="flex items-start gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-slate-950">{ev.title}</p>
          {showDetails && (
            <>
              {ev.subtitle && <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{ev.subtitle}</p>}
              <div className="flex items-center gap-1.5 mt-1">
                {ev.woNumber && <span className="text-[9px] font-bold text-slate-400">{ev.woNumber}</span>}
                <span className="text-[9px] font-bold text-slate-400 uppercase">{STATUS_LABEL[ev.status] ?? ev.status}</span>
                <span className={`w-1 h-1 rounded-full ${prioColor}`} />
              </div>
              {ev.assignee && <p className="text-[9px] text-slate-400 font-medium mt-0.5">→ {ev.assignee}</p>}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
