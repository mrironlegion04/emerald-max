'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, RotateCcw, X, ClipboardList, Search } from 'lucide-react'
import Badge from './Badge'

interface TaskTemplateTask {
  title: string
  description: string
  priority: string
  assignedToId: string
  assignedTeamId: string
  required: boolean
}

interface TaskTemplate {
  id: string
  name: string
  description: string | null
  isDeleted: boolean
  createdAt: string
  _count: { tasks: number; pmSchedules: number }
}

interface Props {
  initialTemplates: TaskTemplate[]
}

export default function TaskTemplateManager({ initialTemplates }: Props) {
  const router = useRouter()
  const [templates] = useState<TaskTemplate[]>(initialTemplates)
  const [showDeleted, setShowDeleted] = useState(false)
  const [archivedTemplates, setArchivedTemplates] = useState<TaskTemplate[]>([])
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTasks, setEditTasks] = useState<TaskTemplateTask[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const filteredActive = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const filteredArchived = archivedTemplates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleShowDeleted = useCallback(async () => {
    const next = !showDeleted
    setShowDeleted(next)
    if (next && archivedTemplates.length === 0) {
      setLoadingArchived(true)
      try {
        const res = await fetch('/api/task-templates?includeDeleted=true')
        if (res.ok) {
          const all = await res.json()
          setArchivedTemplates(all.filter((t: TaskTemplate) => t.isDeleted))
        }
      } catch { /* keep empty */ }
      setLoadingArchived(false)
    }
  }, [showDeleted, archivedTemplates.length])

  function openCreate() {
    setEditId(null)
    setEditName('')
    setEditDescription('')
    setEditTasks([])
    setError('')
    setModalOpen(true)
  }

  async function openEdit(t: TaskTemplate) {
    setEditId(t.id)
    setEditName(t.name)
    setEditDescription(t.description ?? '')
    setError('')
    const res = await fetch(`/api/task-templates/${t.id}`)
    if (res.ok) {
      const data = await res.json()
      setEditTasks(data.tasks.map((task: any) => ({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        assignedToId: task.assignedToId ?? '',
        assignedTeamId: task.assignedTeamId ?? '',
        required: task.required,
      })))
    }
    setModalOpen(true)
  }

  function addTask() {
    setEditTasks(prev => [...prev, {
      title: '', description: '', priority: 'MEDIUM',
      assignedToId: '', assignedTeamId: '', required: true,
    }])
  }

  function updateTask(index: number, field: keyof TaskTemplateTask, value: string | boolean) {
    setEditTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  function removeTask(index: number) {
    setEditTasks(prev => prev.filter((_, i) => i !== index))
  }

  function moveTask(index: number, direction: -1 | 1) {
    setEditTasks(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return next
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSave() {
    if (!editName.trim()) { setError('Name is required'); return }
    const validTasks = editTasks.filter(t => t.title.trim())
    setSaving(true); setError('')
    try {
      const body = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        tasks: validTasks.map(t => ({
          title: t.title.trim(),
          description: t.description.trim() || null,
          priority: t.priority,
          assignedToId: t.assignedToId || null,
          assignedTeamId: t.assignedTeamId || null,
          required: t.required,
        })),
      }
      const url = editId ? `/api/task-templates/${editId}` : '/api/task-templates'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Save failed')
        return
      }
      setModalOpen(false)
      router.refresh()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/task-templates/${id}`, { method: 'DELETE' })
    if (res.ok) { router.refresh() }
    setDeleteConfirmId(null)
  }

  async function handleRestore(id: string) {
    const res = await fetch(`/api/task-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    })
    if (res.ok) { router.refresh() }
  }

  const hasAnyTemplates = templates.length > 0 || archivedTemplates.length > 0
  const isSearching = search.trim().length > 0

  return (
    <div className="space-y-6">
      {/* Search + New row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates\u2026"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5 whitespace-nowrap">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Archived toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showDeleted} onChange={toggleShowDeleted}
            className="w-4 h-4 text-red-600 rounded border-gray-300" />
          Show archived
        </label>
      </div>

      {/* Active templates */}
      {!hasAnyTemplates && !isSearching ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No task templates yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create reusable checklists for your PM schedules.</p>
        </div>
      ) : filteredActive.length === 0 && !showDeleted ? (
        <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-400">
            {isSearching ? `No active templates match \u201c${search}\u201d` : 'No active templates on this page.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {filteredActive.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400">
                  {t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}
                  {t._count.pmSchedules > 0 && ` \u00b7 linked to ${t._count.pmSchedules} PM${t._count.pmSchedules !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(t)} className="text-xs text-gray-500 hover:underline font-medium">Edit</button>
                {deleteConfirmId === t.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleArchive(t.id)} className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-2 rounded">Archive</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirmId(t.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Archive</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived templates */}
      {showDeleted && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          <div className="px-5 py-2 bg-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Archived
              {filteredArchived.length > 0 && ` \u00b7 ${filteredArchived.length}`}
            </p>
          </div>
          {loadingArchived ? (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400">Loading archived\u2026</p>
            </div>
          ) : filteredArchived.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400">
                {isSearching ? `No archived templates match \u201c${search}\u201d` : 'No archived templates.'}
              </p>
            </div>
          ) : (
            filteredArchived.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-400 line-through">{t.name}</p>
                  <p className="text-xs text-gray-400">
                    {t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}
                    {t._count.pmSchedules > 0 && ` \u00b7 linked to ${t._count.pmSchedules} PM${t._count.pmSchedules !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label="Archived" variant="red" />
                  <button onClick={() => handleRestore(t.id)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editId ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. HVAC Safety Checklist"
                  className="input-field w-full text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                  className="input-field w-full text-sm" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tasks ({editTasks.length})</label>
                {editTasks.map((task, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-6 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                      <input type="text" value={task.title} onChange={e => updateTask(i, 'title', e.target.value)}
                        placeholder="Task title" className="input-field flex-1 text-sm" />
                      <select value={task.priority} onChange={e => updateTask(i, 'priority', e.target.value)}
                        className="input-field w-28 text-xs">
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-500 select-none">
                        <input type="checkbox" checked={task.required} onChange={e => updateTask(i, 'required', e.target.checked)}
                          className="w-3.5 h-3.5 rounded" />
                        Req
                      </label>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button type="button" onClick={() => moveTask(i, -1)} disabled={i === 0}
                          className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => moveTask(i, 1)} disabled={i === editTasks.length - 1}
                          className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => removeTask(i)} className="p-0.5 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input type="text" value={task.description} onChange={e => updateTask(i, 'description', e.target.value)}
                      placeholder="Optional description" className="input-field w-full text-xs" />
                  </div>
                ))}
                <button type="button" onClick={addTask} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add task
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary text-sm disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
