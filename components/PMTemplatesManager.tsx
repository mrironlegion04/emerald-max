'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, Calendar, ClipboardCheck, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react'

interface Category {
  id: string
  name: string
}

interface Procedure {
  id: string
  name: string
}

interface PMTemplate {
  id: string
  title: string
  description: string | null
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  interval: number
  categoryId: string
  category: {
    id: string
    name: string
  }
  procedures: {
    procedure: {
      id: string
      name: string
    }
  }[]
  createdAt: Date | string
}

interface Props {
  categories: Category[]
  procedures: Procedure[]
  initialTemplates: PMTemplate[]
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Day(s)',
  WEEKLY: 'Week(s)',
  MONTHLY: 'Month(s)',
  QUARTERLY: 'Quarter(s)',
  YEARLY: 'Year(s)',
}

export default function PMTemplatesManager({ categories, procedures, initialTemplates }: Props) {
  const [templates, setTemplates] = useState<PMTemplate[]>(initialTemplates)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [interval, setIntervalVal] = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleToggleProcedure = (id: string) => {
    setSelectedProcedures(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    if (!title.trim()) {
      setError('Title is required')
      setSaving(false)
      return
    }

    if (!categoryId) {
      setError('Category is required')
      setSaving(false)
      return
    }

    if (selectedProcedures.length === 0) {
      setError('At least one checklist procedure is required')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/settings/pm-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          frequency,
          interval,
          categoryId,
          procedureIds: selectedProcedures,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save template')
        return
      }

      setTemplates(prev => [data, ...prev])
      // Reset form
      setTitle('')
      setDescription('')
      setIntervalVal(1)
      setCategoryId('')
      setSelectedProcedures([])
    } catch {
      setError('Network error - please check your connection')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PM template? Assets created in the future will no longer receive these schedules.')) {
      return
    }

    setDeletingId(id)
    setError('')

    try {
      const res = await fetch(`/api/settings/pm-templates/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to delete template')
        return
      }

      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch {
      setError('Network error - failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
      {/* Creation form */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 self-start">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5">
          New Category PM Rule
        </h2>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Template title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Monthly Electrical Inspection"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide context or instructions for this PM schedule..."
              className="input-field min-h-16"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Frequency *
              </label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as any)}
                className="input-field"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Every (Interval) *
              </label>
              <input
                type="number"
                min={1}
                value={interval}
                onChange={e => setIntervalVal(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Triggers for Category *
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">— Select Category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              When a new asset is assigned to this category, this checklist template is applied.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Checklist Procedures *
            </label>
            <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50/50">
              {procedures.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No procedure templates created yet.</p>
              ) : (
                procedures.map(proc => {
                  const isChecked = selectedProcedures.includes(proc.id)
                  return (
                    <label key={proc.id} className="flex items-start gap-2.5 p-1.5 hover:bg-white rounded-md cursor-pointer transition-colors border border-transparent hover:border-slate-100 select-none text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleProcedure(proc.id)}
                        className="rounded-sm text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 mt-0.5"
                      />
                      <span className="text-slate-700 font-medium">{proc.name}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-md transition-all text-sm disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving Rules...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create PM Template Rule
              </>
            )}
          </button>
        </form>
      </div>

      {/* Rules list */}
      <div className="lg:col-span-7 space-y-4">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-2 flex items-center gap-2">
          Registered Templates <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">{templates.length}</span>
        </h2>

        {templates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">No category template mappings yet</p>
            <p className="text-sm text-slate-500 mt-1">Configure one on the left to automate PM installations!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {templates.map(st => (
                <motion.div
                  key={st.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-200 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase py-0.5 px-2 rounded-full">
                        📁 {st.category.name}
                      </span>
                      <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold uppercase py-0.5 px-2 rounded-full flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Every {st.interval} {FREQUENCY_LABELS[st.frequency]}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{st.title}</h3>
                    {st.description && <p className="text-xs text-slate-500 line-clamp-2">{st.description}</p>}

                    <div className="pt-2 border-t border-slate-50 flex items-center gap-1 flex-wrap">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Checklists:</p>
                      {st.procedures.map((p, idx) => (
                        <div key={idx} className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1">
                          <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.procedure.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(st.id)}
                    disabled={deletingId === st.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg group-hover:opacity-100 transition-all self-end md:self-center disabled:opacity-50"
                    title="Delete custom template rule"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
