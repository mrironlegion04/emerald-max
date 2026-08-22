'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Search, GripVertical, Trash2, ArrowLeft, Download } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as XLSX from 'xlsx'

interface TaskTemplateTask {
  title: string; description: string; priority: string; assignedToId: string; assignedTeamId: string; required: boolean
}

interface Props {
  templateId?: string
  initialName?: string
  initialDescription?: string
  initialTasks?: TaskTemplateTask[]
}

function SortableRow({ id, index, onRemove, onEdit, priority, required, title }: {
  id: string; index: number; onRemove: () => void; onEdit: () => void;
  priority: string; required: boolean; title: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined }
  const pc = priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : priority === 'LOW' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer" onClick={onEdit}>
      <div {...attributes} {...listeners} className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4 text-gray-300" /></div>
      <span className="flex-shrink-0 w-5 text-center text-xs font-bold text-gray-400">{index + 1}</span>
      <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{title || <span className="italic text-gray-400">Untitled task</span>}</span>
      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${pc}`}>{priority}</span>
      {required && <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Req</span>}
      <button type="button" onClick={e => { e.stopPropagation(); onRemove() }} className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function TaskTemplateForm({ templateId, initialName = '', initialDescription = '', initialTasks = [] }: Props) {
  const router = useRouter()
  const isEdit = !!templateId
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [tasks, setTasks] = useState<TaskTemplateTask[]>(initialTasks)
  const [taskSearch, setTaskSearch] = useState('')
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/teams').then(r => r.ok ? r.json() : []).then(d => setTeams(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  function handleDragEnd(event: { active: { id: string | number }; over: { id: string | number } | null }) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTasks(prev => arrayMove(prev, Number(active.id), Number(over.id)))
  }

  function addTask() {
    setTasks(prev => [...prev, { title: '', description: '', priority: 'MEDIUM', assignedToId: '', assignedTeamId: '', required: true }])
    setEditingTaskIdx(tasks.length)
  }
  function updateTask(index: number, field: keyof TaskTemplateTask, value: string | boolean) {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }
  function removeTask(index: number) {
    setTasks(prev => prev.filter((_, i) => i !== index))
    setEditingTaskIdx(prev => prev === index ? null : prev !== null && prev > index ? prev - 1 : prev)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    const validTasks = tasks.filter(t => t.title.trim())
    setSaving(true); setError('')
    try {
      const body = {
        name: name.trim(), description: description.trim() || null,
        tasks: validTasks.map(t => ({
          title: t.title.trim(), description: t.description.trim() || null, priority: t.priority,
          assignedToId: t.assignedToId || null, assignedTeamId: t.assignedTeamId || null, required: t.required,
        })),
      }
      const url = isEdit ? `/api/task-templates/${templateId}` : '/api/task-templates'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      router.push('/settings/task-templates')
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  function downloadSample() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['template_name', 'template_description', 'task_title', 'task_description', 'task_priority', 'task_assigned_to', 'task_assigned_team', 'task_required'],
      ['HVAC Safety Checklist', 'Monthly HVAC safety inspection', 'Check belt tension', 'Inspect and adjust tension', '', '', '', 'yes'],
      ['', '', 'Lubricate bearings', '', 'medium', '', 'Maintenance Team', 'yes'],
    ])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Templates'); XLSX.writeFile(wb, 'task-templates-sample.xlsx')
  }

  const filtered = taskSearch.trim()
    ? tasks.map((t, i) => ({ t, i })).filter(({ t }) => t.title.toLowerCase().includes(taskSearch.toLowerCase()) || (t.description ?? '').toLowerCase().includes(taskSearch.toLowerCase()))
    : tasks.map((t, i) => ({ t, i }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Task Template' : 'New Task Template'}</h1>
          <p className="text-xs text-gray-500">{isEdit ? 'Update template details and tasks' : 'Create a reusable task template'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HVAC Safety Checklist" className="input-field w-full" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className="input-field w-full" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tasks ({tasks.length})</label>
          <div className="flex items-center gap-2">
            {tasks.length > 5 && (
              <div className="relative">
                <input type="text" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks..." className="input-field pl-7 text-xs py-1 w-48" />
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                {taskSearch && <button onClick={() => setTaskSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
              </div>
            )}
            <button type="button" onClick={downloadSample} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><Download className="w-3 h-3" /> Sample</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">{tasks.length === 0 ? 'No tasks yet. Click "Add task" below.' : 'No tasks match your search.'}</p>
        ) : (
          (() => {
            const isSearching = !!taskSearch.trim()
            const rows = filtered.map(({ t: task, i }) => {
              if (isSearching) {
                const pColor = task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : task.priority === 'LOW' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 opacity-70 cursor-pointer" onClick={() => setEditingTaskIdx(i)}>
                    <span className="flex-shrink-0 w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{task.title || 'Untitled'}</span>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${pColor}`}>{task.priority}</span>
                    {task.required && <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Req</span>}
                  </div>
                )
              }
              return <SortableRow key={i} id={String(i)} index={i} onRemove={() => removeTask(i)} onEdit={() => setEditingTaskIdx(i)} priority={task.priority} required={task.required} title={task.title} />
            })
            if (isSearching) return <div className="space-y-2">{rows}</div>
            return (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filtered.map(({ i }) => String(i))} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">{rows}</div>
                </SortableContext>
              </DndContext>
            )
          })()
        )}

        <button type="button" onClick={addTask} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create template'}</button>
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>

      {/* Task edit slide-over panel */}
      {editingTaskIdx !== null && editingTaskIdx < tasks.length && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditingTaskIdx(null)} />
          <div className="relative bg-white shadow-2xl w-full sm:w-[28rem] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">{editingTaskIdx + 1}</span>
                <h2 className="font-semibold text-gray-900 text-sm">Edit Task</h2>
              </div>
              <button onClick={() => setEditingTaskIdx(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Title</label>
                <input type="text" value={tasks[editingTaskIdx].title} onChange={e => updateTask(editingTaskIdx, 'title', e.target.value)} placeholder="e.g. Check belt tension" className="input-field w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <textarea value={tasks[editingTaskIdx].description} onChange={e => updateTask(editingTaskIdx, 'description', e.target.value)} placeholder="Optional description for this task" rows={3} className="input-field w-full text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</label>
                  <select value={tasks[editingTaskIdx].priority} onChange={e => updateTask(editingTaskIdx, 'priority', e.target.value)} className="input-field w-full">
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Required</label>
                  <button type="button" onClick={() => updateTask(editingTaskIdx, 'required', !tasks[editingTaskIdx].required)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors w-full">
                    <span className={`w-9 h-5 rounded-full relative transition-colors ${tasks[editingTaskIdx].required ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                      <span className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform ${tasks[editingTaskIdx].required ? 'translate-x-4' : ''}`} />
                    </span>
                    <span className={`text-xs font-bold uppercase ${tasks[editingTaskIdx].required ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {tasks[editingTaskIdx].required ? 'Required' : 'Optional'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned User</label>
                <select value={tasks[editingTaskIdx].assignedToId} onChange={e => updateTask(editingTaskIdx, 'assignedToId', e.target.value)} className="input-field w-full">
                  <option value="">-- Unassigned --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Team</label>
                <select value={tasks[editingTaskIdx].assignedTeamId} onChange={e => updateTask(editingTaskIdx, 'assignedTeamId', e.target.value)} className="input-field w-full">
                  <option value="">-- No team --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
              <button onClick={() => setEditingTaskIdx(null)} className="btn-primary text-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
