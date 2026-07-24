'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'

interface SimpleUser { id: string; name: string; email: string }
interface SimpleTeam { id: string; name: string }
interface SimpleCategory { id: string; name: string }
interface Procedure { id: string; name: string; description?: string | null; steps?: { id: string }[] }

interface TemplateFormData {
  name: string
  description: string
  woType: string
  priority: string
  woDescription: string
  notes: string
  assignedToId: string
  teamId: string
  categoryId: string
  procedureIds: string[]
}

interface Props {
  users?: SimpleUser[]
  teams?: SimpleTeam[]
  categories?: SimpleCategory[]
  procedures?: Procedure[]
  initialData?: Partial<TemplateFormData> & { procedures?: { procedure: { id: string } }[] }
  templateId?: string
}

export default function WorkOrderTemplateForm({
  users = [], teams = [], categories = [], procedures = [],
  initialData, templateId,
}: Props) {
  const router = useRouter()
  const isEdit = !!templateId

  const [form, setForm] = useState<TemplateFormData>({
    name:          initialData?.name          ?? '',
    description:   initialData?.description   ?? '',
    woType:        initialData?.woType        ?? 'PREVENTIVE',
    priority:      initialData?.priority      ?? 'MEDIUM',
    woDescription: initialData?.woDescription ?? '',
    notes:         initialData?.notes          ?? '',
    assignedToId:  initialData?.assignedToId  ?? '',
    teamId:        initialData?.teamId        ?? '',
    categoryId:    initialData?.categoryId    ?? '',
    procedureIds:  initialData?.procedures?.map(p => p.procedure?.id).filter(Boolean) ?? (initialData as any)?.procedureIds ?? [],
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: keyof TemplateFormData, value: string | string[]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const payload = {
        name:          form.name,
        description:   form.description || null,
        woType:        form.woType,
        priority:      form.priority,
        woDescription: form.woDescription || null,
        notes:         form.notes || null,
        assignedToId:  form.assignedToId || null,
        teamId:        form.teamId || null,
        categoryId:    form.categoryId || null,
        procedureIds:  form.procedureIds,
      }
      const url    = isEdit ? `/api/wo-templates/${templateId}` : '/api/wo-templates'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/work-order-templates/${data.id}`)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Template info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Template details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="input-field" placeholder="e.g. Monthly HVAC Inspection" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input-field resize-none" rows={2}
            placeholder="Brief description of this template..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work order type</label>
            <select value={form.woType} onChange={e => set('woType', e.target.value)} className="input-field">
              <option value="PREVENTIVE">Preventive</option>
              <option value="BREAKDOWN">Breakdown</option>
              <option value="PREDICTIVE">Predictive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input-field">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Assignment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
            <select value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)} className="input-field">
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select value={form.teamId} onChange={e => set('teamId', e.target.value)} className="input-field">
                <option value="">— No team —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className="input-field">
                <option value="">— No category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Description template */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Work order content</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default description</label>
          <textarea value={form.woDescription} onChange={e => set('woDescription', e.target.value)}
            rows={4} className="input-field"
            placeholder="Description pre-filled when this template is used..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Internal notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} className="input-field"
            placeholder="Notes about when/how to use this template..." />
        </div>
      </div>

      {/* Procedures */}
      {procedures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Procedures</h2>
          </div>
          <p className="text-xs text-gray-400">
            Select procedures to auto-apply when this template is used.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {procedures.map(proc => (
              <label key={proc.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={form.procedureIds.includes(proc.id)}
                  onChange={e => {
                    const newIds = e.target.checked
                      ? [...form.procedureIds, proc.id]
                      : form.procedureIds.filter(id => id !== proc.id)
                    set('procedureIds', newIds)
                  }}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{proc.name}</p>
                  {proc.description && <p className="text-xs text-gray-500">{proc.description}</p>}
                  {proc.steps && <p className="text-xs text-gray-400">{proc.steps.length} steps</p>}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create template'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
