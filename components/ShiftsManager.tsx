'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Power, PowerOff } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

interface Shift {
  id: string
  name: string
  label: string
  startTime: string
  endTime: string
  isActive: boolean
}

const emptyForm = { name: '', label: '', startTime: '00:00', endTime: '08:00' }

export default function ShiftsManager() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadShifts() }, [])

  async function loadShifts() {
    try {
      const res = await fetch('/api/shifts')
      const data = await res.json()
      if (res.ok) setShifts(data)
      else setError(data.error ?? 'Failed to load shifts')
    } finally { setLoading(false) }
  }

  async function createShift() {
    setError('')
    if (!form.name.trim() || !form.label.trim()) { setError('Name and label are required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save shift'); return }
      setShifts(prev => [...prev, data].sort((a, b) => a.startTime.localeCompare(b.startTime)))
      setShowForm(false)
      setForm(emptyForm)
    } finally { setSaving(false) }
  }

  async function updateShift(id: string, patch: Partial<Shift>) {
    const res = await fetch(`/api/shifts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) setShifts(prev => prev.map(s => (s.id === id ? data : s)))
  }

  async function deleteShift(id: string) {
    if (!window.confirm('Delete this shift config?')) return
    const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    if (res.ok) setShifts(prev => prev.filter(s => s.id !== id))
  }

  if (loading) {
    return <div className="p-6 max-w-3xl mx-auto text-sm text-slate-400 font-semibold">Loading shifts…</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Shifts"
        subtitle="Configure time windows for each shift. New work orders are auto-assigned a shift from the current time."
      />

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold">{error}</div>
      )}

      <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white space-y-3">
        {shifts.length === 0 && (
          <p className="text-sm text-slate-400 font-medium">No shift configs yet. Add one below.</p>
        )}
        {shifts.map(s => (
          <div key={s.id} className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">{s.label}</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">{s.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <input
                  type="time"
                  value={s.startTime}
                  onChange={e => updateShift(s.id, { startTime: e.target.value })}
                  className="input-field text-xs bg-white w-28 px-2 py-1"
                />
                <span className="text-xs text-slate-400 font-bold">to</span>
                <input
                  type="time"
                  value={s.endTime}
                  onChange={e => updateShift(s.id, { endTime: e.target.value })}
                  className="input-field text-xs bg-white w-28 px-2 py-1"
                />
                {s.startTime >= s.endTime && s.startTime !== s.endTime && (
                  <span className="text-[10px] text-amber-600 font-bold">wraps past midnight</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateShift(s.id, { isActive: !s.isActive })}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition"
              title={s.isActive ? 'Deactivate' : 'Activate'}
            >
              {s.isActive ? <Power className="w-4 h-4 text-emerald-600" /> : <PowerOff className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              type="button"
              onClick={() => deleteShift(s.id)}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white mt-4 space-y-4">
          <h2 className="font-bold text-slate-700 text-sm tracking-tight">New shift</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Shift name (code)</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="SHIFTA"
                className="input-field text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Shift A"
                className="input-field text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Start time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                className="input-field text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">End time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                className="input-field text-xs bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 font-medium">An end time earlier than the start means the window wraps past midnight.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={createShift} disabled={saving} className="btn-primary text-xs font-bold py-2.5 px-5">
              {saving ? 'Saving...' : 'Save shift'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm) }} className="btn-secondary text-xs font-bold py-2.5 px-5 border-slate-200/65 transition hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 inline-flex items-center gap-2 btn-primary text-xs font-bold py-2.5 px-5"
        >
          <Plus className="w-4 h-4" /> Add shift
        </button>
      )}
    </div>
  )
}
