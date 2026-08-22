'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, RotateCcw, X, ClipboardList } from 'lucide-react'
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

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-blue-50 text-blue-600',
  LOW: 'bg-gray-100 text-gray-500',
}

export default function TaskTemplateManager() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTasks, setEditTasks] = useState<TaskTemplateTask[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = showDeleted ? '?includeDeleted=true' : ''
      const res = await fetch(`/api/task-templates${params}`)
      if (res.ok) setTemplates(await res.json())
    } finally { setLoading(false) }
  }, [showDeleted])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

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
      fetchTemplates()
      router.refresh()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/task-templates/${id}`, { method: 'DELETE' })
    if (res.ok) { fetchTemplates(); router.refresh() }
    setDeleteConfirmId(null)
  }

  async function handleRestore(id: string) {
    const res = await fetch(`/api/task-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    })
    if (res.ok) { fetchTemplates(); router.refresh() }
  }

  const activeTemplates = templates.filter(t => !t.isDeleted)
  const archivedTemplates = templates.filter(t => t.isDeleted)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded border-gray-300" />
            Show archived
          </label>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No task templates yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create reusable checklists for your PM schedules.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTemplates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {activeTemplates.map(t => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}
                      {t._count.pmSchedules > 0 && ` · linked to ${t._count.pmSchedules} PM`}
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

          {showDeleted && archivedTemplates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              <div className="px-5 py-2 bg-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Archived</p>
              </div>
              {archivedTemplates.map(t => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-400 line-through">{t.name}</p>
                    <p className="text-xs text-gray-400">{t._count.tasks} tasks</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label="Archived" variant="red" />
                    <button onClick={() => handleRestore(t.id)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                      <button onClick={() => removeTask(i)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input type="text" value={task.description} onChange={e => updateTask(i, 'description', e.target.value)}
                      placeholder="Optional description" className="input-field w-full text-xs" />
                  </div>
                ))}
                <button onClick={addTask} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
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
