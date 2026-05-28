'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CalEvent {
  id: string; type: 'wo'|'pm'; title: string; subtitle: string
  date: string; status: string; priority: string; woType: string; href: string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const priorityDot: Record<string,string> = {
  CRITICAL:'bg-red-500', HIGH:'bg-orange-400', MEDIUM:'bg-blue-400', LOW:'bg-gray-400', SCHEDULED:'bg-purple-400',
}
const statusColor: Record<string,string> = {
  OPEN:'bg-blue-50 border-blue-200 text-blue-800',
  IN_PROGRESS:'bg-yellow-50 border-yellow-200 text-yellow-800',
  COMPLETED:'bg-green-50 border-green-200 text-green-700',
  ON_HOLD:'bg-orange-50 border-orange-200 text-orange-800',
  CANCELLED:'bg-gray-50 border-gray-200 text-gray-500',
  SCHEDULED:'bg-purple-50 border-purple-200 text-purple-800',
}

export default function CalendarView() {
  const today   = new Date()
  const [year,  setYear]   = useState(today.getFullYear())
  const [month, setMonth]  = useState(today.getMonth() + 1)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null) // 'YYYY-MM-DD'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setLoading(false) })
  }, [year, month])

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const grid: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (grid.length % 7 !== 0) grid.push(null)

  function dateKey(day: number) {
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  function eventsForDay(day: number) {
    const dk = dateKey(day)
    return events.filter(e => {
      const d = new Date(e.date)
      const ek = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      return ek === dk
    })
  }

  const selectedEvents = selected
    ? events.filter(e => {
        const d = new Date(e.date)
        const ek = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        return ek === selected
      })
    : []

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prev} className="btn-secondary text-sm py-1.5 px-3">←</button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-48 text-center">{MONTHS[month-1]} {year}</h2>
          <button onClick={next} className="btn-secondary text-sm py-1.5 px-3">→</button>
        </div>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()+1); setSelected(null) }}
          className="btn-secondary text-sm py-1.5">Today</button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />Open WO</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />In progress</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />PM due</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />Critical</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/20">
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-bold text-slate-400 select-none uppercase tracking-wider">{d}</div>
            ))}
          </div>

          {/* Cells */}
          {loading ? (
            <div className="py-24 text-center text-sm font-semibold text-slate-400">Fetching scheduled events...</div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 border-l border-t border-transparent select-none">
              {grid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="min-h-12 md:min-h-24 bg-slate-50/20 border-slate-100" />
                const dk    = dateKey(day)
                const dayEvts = eventsForDay(day)
                const isToday = dk === todayKey
                const isSel   = dk === selected
                return (
                  <div key={dk}
                    onClick={() => setSelected(isSel ? null : dk)}
                    className={`min-h-13 md:min-h-24 p-1 md:p-2 cursor-pointer transition-all hover:bg-slate-50/50 ${
                      isSel ? 'bg-blue-50/60 border-2 border-blue-500/80 shadow-3xs' : isToday ? 'bg-amber-50/40' : ''
                    }`}>
                    <div className="flex md:flex-row flex-col items-center justify-between md:mb-1.5 gap-0.5">
                      <div className={`text-xs font-bold w-5.5 h-5.5 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-600 text-white shadow-3xs' : 'text-slate-700'
                      }`}>{day}</div>
                      {/* Compact dot layout for mobile viewports */}
                      {dayEvts.length > 0 && (
                        <span className="flex md:hidden items-center justify-center w-1.5 h-1.5 rounded-full bg-blue-505 bg-blue-600 shadow-3xs animate-pulse-subtle" />
                      )}
                    </div>
                    
                    {/* Event details - only on larger screens */}
                    <div className="hidden md:block space-y-1">
                      {dayEvts.slice(0,3).map(ev => (
                        <div key={ev.id} className="flex items-center gap-1.5 p-1 rounded hover:bg-white/80 transition-all border border-transparent hover:border-slate-150">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[ev.type === 'pm' ? 'SCHEDULED' : ev.priority] ?? 'bg-slate-400'}`} />
                          <span className="text-[10px] font-bold text-slate-755 truncate leading-tight">{ev.title}</span>
                        </div>
                      ))}
                      {dayEvts.length > 3 && (
                        <div className="text-[9px] font-bold text-slate-420 pl-3">+{dayEvts.length - 3} others</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Side panel - selected day events */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] flex flex-col">
          {!selected ? (
            <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
              <span className="w-10 h-10 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-400 font-medium text-lg mb-2">📅</span>
              <p className="text-xs font-bold text-slate-420 uppercase tracking-wider">No Day Selected</p>
              <p className="text-[11px] text-slate-400 font-medium max-w-[180px] mt-1">Tap any calendar date to view scheduled maintenance and work orders.</p>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 pb-2 border-b border-dashed border-slate-150">
                {new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric'}).format(new Date(selected + 'T12:00:00'))}
              </h3>
              {selectedEvents.length === 0 ? (
                <div className="py-10 text-center text-xs font-medium text-slate-400">No events scheduled for this date.</div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                  {selectedEvents.map(ev => (
                    <Link key={ev.id} href={ev.href}
                      className={`block p-3 rounded-xl border text-xs transition-all hover:translate-y-[-1px] shadow-3xs active:scale-98 ${statusColor[ev.status] ?? 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <p className="font-bold leading-snug">{ev.title}</p>
                      {ev.subtitle && <p className="mt-0.5 text-[10px] opacity-80 font-medium truncate">{ev.subtitle}</p>}
                      <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-black/5">
                        <span className={`w-2 h-2 rounded-full border border-black/10 shadow-3xs ${priorityDot[ev.priority] ?? 'bg-slate-400'}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider">{ev.type === 'pm' ? 'PM task due' : ev.status.replace('_',' ')}</span>
                        {ev.type === 'wo' && <span className="text-[9px] text-black/40 font-bold ml-auto">{ev.priority}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}