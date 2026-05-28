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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          {/* Cells */}
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-7">
              {grid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="min-h-24 border-b border-r border-gray-50 bg-gray-50/30" />
                const dk    = dateKey(day)
                const dayEvts = eventsForDay(day)
                const isToday = dk === todayKey
                const isSel   = dk === selected
                return (
                  <div key={dk}
                    onClick={() => setSelected(isSel ? null : dk)}
                    className={`min-h-24 p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                      isSel ? 'bg-blue-50' : isToday ? 'bg-amber-50/60' : 'hover:bg-gray-50'
                    }`}>
                    <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                    }`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayEvts.slice(0,3).map(ev => (
                        <div key={ev.id} className="flex items-center gap-1 overflow-hidden">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[ev.type === 'pm' ? 'SCHEDULED' : ev.priority] ?? 'bg-gray-400'}`} />
                          <span className="text-xs text-gray-600 truncate leading-tight">{ev.title}</span>
                        </div>
                      ))}
                      {dayEvts.length > 3 && (
                        <span className="text-xs text-gray-400">+{dayEvts.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Side panel - selected day events */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {!selected ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">Click a day to see its events</p>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">
                {new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(new Date(selected + 'T12:00:00'))}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-gray-400">No events this day</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(ev => (
                    <Link key={ev.id} href={ev.href}
                      className={`block p-3 rounded-lg border text-xs transition-colors hover:opacity-80 ${statusColor[ev.status] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                      <p className="font-semibold leading-tight">{ev.title}</p>
                      {ev.subtitle && <p className="mt-0.5 opacity-70">{ev.subtitle}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[ev.priority] ?? 'bg-gray-400'}`} />
                        <span>{ev.type === 'pm' ? 'PM due' : ev.status.replace('_',' ')}</span>
                        {ev.type === 'wo' && <span>· {ev.priority}</span>}
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