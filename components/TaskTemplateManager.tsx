'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, RotateCcw, X, ClipboardList, Search, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, GripVertical, PenLine } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as XLSX from 'xlsx'
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
  updatedAt: string
  createdBy: { id: string; name: string } | null
  updatedBy: { id: string; name: string } | null
  _count: { tasks: number; pmSchedules: number }
}

interface Props {
  initialTemplates: TaskTemplate[]
}

type SortField = 'name' | 'tasks' | 'pmSchedules' | 'updatedAt'

function SortableRow({ id, index, onRemove, onEdit, priority, required, title }: {
  id: string; index: number; onRemove: () => void; onEdit: () => void;
  priority: string; required: boolean; title: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }
  const priorityColor = priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : priority === 'LOW' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div {...attributes} {...listeners} className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-gray-300" />
      </div>
      <span className="flex-shrink-0 w-5 text-center text-xs font-bold text-gray-400">{index + 1}</span>
      <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{title || <span className="italic text-gray-400">Untitled task</span>}</span>
      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${priorityColor}`}>{priority}</span>
      {required && <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Req</span>}
      <button type="button" onClick={onEdit} className="flex-shrink-0 p-1 text-gray-300 hover:text-blue-500" title="Edit task"><PenLine className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onRemove() }} className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}
type SortDir = 'asc' | 'desc'

export default function TaskTemplateManager({ initialTemplates }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates)
  const [showDeleted, setShowDeleted] = useState(false)
  const [archivedTemplates, setArchivedTemplates] = useState<TaskTemplate[]>([])
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [search, setSearch] = useState('')

  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTasks, setEditTasks] = useState<TaskTemplateTask[]>([])
  const [taskSearch, setTaskSearch] = useState('')
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const csvInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<{ name: string; description: string; tasks: TaskTemplateTask[] }[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)

  const [users, setUsers] = useState<{ id: string; name: string; username?: string; email: string }[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d.map((u: any) => ({ id: u.id, name: u.name, username: u.username, email: u.email })) : [])).catch(() => {})
    fetch('/api/teams').then(r => r.ok ? r.json() : []).then(d => setTeams(Array.isArray(d) ? d.map((t: any) => ({ id: t.id, name: t.name })) : [])).catch(() => {})
  }, [])

  const filterAndSort = useCallback((list: TaskTemplate[]) => {
    let filtered = list.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase())
    )
    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'tasks': cmp = a._count.tasks - b._count.tasks; break
        case 'pmSchedules': cmp = a._count.pmSchedules - b._count.pmSchedules; break
        case 'updatedAt': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return filtered
  }, [search, sortField, sortDir])

  const filteredActive = filterAndSort(templates)
  const filteredArchived = filterAndSort(archivedTemplates)

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-500" />
      : <ArrowDown className="w-3 h-3 text-blue-500" />
  }

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
    setEditId(null); setEditName(''); setEditDescription(''); setEditTasks([]); setTaskSearch(''); setEditingTaskIdx(null); setError(''); setModalOpen(true)
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function handleTaskDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    setEditTasks(prev => arrayMove(prev, oldIndex, newIndex))
  }

  async function openEdit(t: TaskTemplate) {
    setEditId(t.id); setEditName(t.name); setEditDescription(t.description ?? ''); setTaskSearch(''); setEditingTaskIdx(null); setError('')
    const res = await fetch(`/api/task-templates/${t.id}`)
    if (res.ok) {
      const data = await res.json()
      setEditTasks(data.tasks.map((task: any) => ({
        title: task.title, description: task.description ?? '', priority: task.priority,
        assignedToId: task.assignedToId ?? '', assignedTeamId: task.assignedTeamId ?? '', required: task.required,
      })))
    }
    setModalOpen(true)
  }

  function addTask() {
    setEditTasks(prev => [...prev, { title: '', description: '', priority: 'MEDIUM', assignedToId: '', assignedTeamId: '', required: true }])
    setEditingTaskIdx(editTasks.length)
  }
  function updateTask(index: number, field: keyof TaskTemplateTask, value: string | boolean) {
    setEditTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }
  function removeTask(index: number) { setEditTasks(prev => prev.filter((_, i) => i !== index)) }

  async function handleSave() {
    if (!editName.trim()) { setError('Name is required'); return }
    const validTasks = editTasks.filter(t => t.title.trim())
    setSaving(true); setError('')
    try {
      const body = {
        name: editName.trim(), description: editDescription.trim() || null,
        tasks: validTasks.map(t => ({
          title: t.title.trim(), description: t.description.trim() || null, priority: t.priority,
          assignedToId: t.assignedToId || null, assignedTeamId: t.assignedTeamId || null, required: t.required,
        })),
      }
      const url = editId ? `/api/task-templates/${editId}` : '/api/task-templates'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setModalOpen(false)
      if (editId) {
        setTemplates(prev => prev.map(t => t.id === editId ? { ...t, name: body.name, description: body.description, _count: { ...t._count, tasks: validTasks.length } } : t))
      } else {
        const data = await res.json()
        setTemplates(prev => [...prev, { id: data.id, name: data.name, description: data.description, isDeleted: false, createdAt: data.createdAt, updatedAt: data.createdAt, createdBy: data.createdBy ?? null, updatedBy: null, _count: { tasks: data._count?.tasks ?? validTasks.length, pmSchedules: 0 } }])
      }
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/task-templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const archived = templates.find(t => t.id === id)
      if (archived) {
        setTemplates(prev => prev.filter(t => t.id !== id))
        setArchivedTemplates(prev => [...prev, { ...archived, isDeleted: true }])
      }
    }
    setDeleteConfirmId(null)
  }

  async function handleRestore(id: string) {
    const res = await fetch(`/api/task-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }),
    })
    if (res.ok) {
      const restored = archivedTemplates.find(t => t.id === id)
      if (restored) {
        setArchivedTemplates(prev => prev.filter(t => t.id !== id))
        setTemplates(prev => [...prev, { ...restored, isDeleted: false }])
      }
    }
  }

  function downloadSample() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['template_name', 'template_description', 'task_title', 'task_description', 'task_priority', 'task_assigned_to', 'task_assigned_team', 'task_required'],
      ['HVAC Safety Checklist', 'Monthly HVAC safety inspection', 'Check belt tension', 'Inspect and adjust tension', '', 'Ankit Mehta', '', 'yes'],
      ['', '', 'Lubricate bearings', '', 'medium', '', 'Maintenance Team', 'yes'],
      ['', '', 'Replace worn seals', 'Check seal condition', 'high', '', 'Mechanical', 'no'],
      ['Electrical Inspection', 'Quarterly electrical checks', 'Test circuit breakers', 'Verify all breakers trip correctly', 'high', '', 'Electrical', 'yes'],
      ['', '', 'Inspect wiring', 'Look for frayed or damaged wires', '', '', '', 'yes'],
    ])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Templates'); XLSX.writeFile(wb, 'task-templates-sample.xlsx')
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = () => { const wb = XLSX.read(String(reader.result ?? ''), { type: 'string' }); const ws = wb.Sheets[wb.SheetNames[0]]; processImportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })) }
      reader.readAsText(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = () => { const wb = XLSX.read(reader.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; processImportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })) }
      reader.readAsArrayBuffer(file)
    } else { setImportResult(null); setImportPreview([]); alert('Unsupported file type. Please upload a .csv or .xlsx file.') }
  }

  function processImportRows(rows: Record<string, unknown>[]) {
    setImportResult(null)
    if (rows.length === 0) { alert('No rows found in the file.'); return }
    const normalized = rows.map(row => {
      const obj: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) { obj[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim() }
      return obj
    })

    const templateMap = new Map<string, { name: string; description: string; tasks: TaskTemplateTask[] }>()
    let lastTemplateName = ''
    for (const row of normalized) {
      const templateName = (row.template_name ?? '').trim() || lastTemplateName
      if (!templateName) continue
      lastTemplateName = templateName
      if (!templateMap.has(templateName)) {
        templateMap.set(templateName, { name: templateName, description: (row.template_description ?? '').trim(), tasks: [] })
      }
      const taskTitle = (row.task_title ?? row.title ?? '').trim()
      if (!taskTitle) continue

      const assigneeRaw = (row.task_assigned_to ?? row.assigned_to ?? '').trim()
      let assignedToId = ''
      if (assigneeRaw) {
        const target = assigneeRaw.toLowerCase()
        const match = users.find(u => u.username?.toLowerCase() === target)
          ?? users.find(u => u.email.toLowerCase() === target)
          ?? users.find(u => u.name.toLowerCase() === target)
        if (match) assignedToId = match.id
      }

      const teamRaw = (row.task_assigned_team ?? row.assigned_team ?? '').trim()
      let assignedTeamId = ''
      if (teamRaw) {
        const target = teamRaw.toLowerCase()
        const match = teams.find(t => t.name.toLowerCase() === target)
        if (match) assignedTeamId = match.id
      }

      templateMap.get(templateName)!.tasks.push({
        title: taskTitle,
        description: (row.task_description ?? row.description ?? '').trim(),
        priority: (row.task_priority ?? row.priority ?? 'MEDIUM').trim().toUpperCase() || 'MEDIUM',
        assignedToId, assignedTeamId,
        required: (row.task_required ?? row.required ?? 'yes').trim().toLowerCase() !== 'no',
      })
    }

    setImportPreview(Array.from(templateMap.values()).filter(t => t.tasks.length > 0))
    setImportModalOpen(true)
  }

  async function confirmImport() {
    setImporting(true); setImportResult(null)
    let success = 0, failed = 0
    for (const tpl of importPreview) {
      try {
        const res = await fetch('/api/task-templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tpl.name, description: tpl.description || null,
            tasks: tpl.tasks.map(t => ({
              title: t.title, description: t.description || null, priority: t.priority,
              assignedToId: t.assignedToId || null, assignedTeamId: t.assignedTeamId || null, required: t.required,
            })),
          }),
        })
        if (res.ok) {
          success++; const data = await res.json()
          setTemplates(prev => [...prev, { id: data.id, name: data.name, description: data.description, isDeleted: false, createdAt: data.createdAt, updatedAt: data.createdAt, createdBy: null, updatedBy: null, _count: { tasks: data._count?.tasks ?? tpl.tasks.length, pmSchedules: 0 } }])
        } else failed++
      } catch { failed++ }
    }
    setImportResult({ success, failed }); setImporting(false)
  }

  const hasAnyTemplates = templates.length > 0 || archivedTemplates.length > 0
  const isSearching = search.trim().length > 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search + Actions */}
      <div className="space-y-3">
        <div className="relative group">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="input-field pl-10 text-sm" />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> New Template</button>
          <button onClick={() => csvInputRef.current?.click()} className="btn-secondary text-sm flex items-center gap-1.5"><Upload className="w-4 h-4" /> Import</button>
          <button onClick={downloadSample} className="btn-secondary text-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Sample</button>
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input type="checkbox" checked={showDeleted} onChange={toggleShowDeleted} className="w-4 h-4 text-red-600 rounded border-gray-300" />
        Show archived
      </label>

      {!hasAnyTemplates && !isSearching && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No task templates yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create reusable checklists for your PM schedules.</p>
        </div>
      )}

      {hasAnyTemplates && filteredActive.length === 0 && !showDeleted && (
        <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-400">{isSearching ? `No active templates match \u201c${search}\u201d` : 'No active templates on this page.'}</p>
        </div>
      )}

      {/* Desktop table */}
      {filteredActive.length > 0 && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {[['name','Name'],['tasks','Tasks'],['pmSchedules','Linked PMs'],['updatedAt','Updated']].map(([f, l]) => (
                  <th key={f} onClick={() => toggleSort(f as SortField)} className="text-left px-5 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                    <span className="flex items-center gap-1.5">{l} <SortIcon field={f as SortField} /></span>
                  </th>
                ))}
                <th className="text-right px-5 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredActive.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900 truncate max-w-xs">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-400 truncate max-w-xs">{t.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{t._count.tasks}</td>
                  <td className="px-5 py-3.5 text-gray-600">{t._count.pmSchedules > 0 ? t._count.pmSchedules : <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    <div>{new Date(t.updatedAt).toLocaleDateString()}</div>
                    {t.updatedBy && <div className="text-gray-400">{t.updatedBy.name}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list */}
      {filteredActive.length > 0 && (
        <div className="md:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {filteredActive.map(t => (
            <div key={t.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}
                    {t._count.pmSchedules > 0 && ` \u00b7 ${t._count.pmSchedules} PM`}
                    {t.updatedBy && ` \u00b7 by ${t.updatedBy.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
            </div>
          ))}
        </div>
      )}

      {/* Archived */}
      {showDeleted && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          <div className="px-4 py-2 sm:px-5 bg-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Archived{filteredArchived.length > 0 && ` \u00b7 ${filteredArchived.length}`}</p>
          </div>
          {loadingArchived ? (
            <div className="px-4 py-4 sm:px-5"><p className="text-xs text-gray-400">Loading archived...</p></div>
          ) : filteredArchived.length === 0 ? (
            <div className="px-4 py-4 sm:px-5"><p className="text-xs text-gray-400">{isSearching ? `No archived templates match \u201c${search}\u201d` : 'No archived templates.'}</p></div>
          ) : (
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">Tasks</th>
                  <th className="text-right px-5 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredArchived.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-400 line-through truncate max-w-xs">{t.name}</p>
                        {t.description && <p className="text-xs text-gray-400 truncate max-w-xs">{t.description}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-400">{t._count.tasks}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge label="Archived" variant="red" />
                          <button onClick={() => handleRestore(t.id)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredArchived.length > 0 && (
            <div className="md:hidden">
              {filteredArchived.map(t => (
                <div key={t.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-400 line-through truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge label="Archived" variant="red" />
                      <button onClick={() => handleRestore(t.id)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit/Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:mx-4 h-full sm:h-auto sm:max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{editId ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. HVAC Safety Checklist" className="input-field w-full text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Optional description" className="input-field w-full text-sm" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tasks ({editTasks.length})</label>
                  {editTasks.length > 5 && (
                    <div className="relative group flex-1 max-w-[200px]">
                      <input type="text" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks..." className="input-field pl-7 text-xs py-1" />
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                      {taskSearch && <button onClick={() => setTaskSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
                    </div>
                  )}
                </div>
                {(() => {
                  const filtered = taskSearch.trim()
                    ? editTasks.map((t, i) => ({ t, i })).filter(({ t }) =>
                        t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                        (t.description ?? '').toLowerCase().includes(taskSearch.toLowerCase())
                      )
                    : editTasks.map((t, i) => ({ t, i }))
                  if (filtered.length === 0) {
                    return <p className="text-xs text-gray-400 py-3 text-center">No tasks match &ldquo;{taskSearch}&rdquo;</p>
                  }
                  const isSearching = !!taskSearch.trim()
                  const taskRows = filtered.map(({ t: task, i }) => {
                    if (isSearching) {
                      const pc = task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : task.priority === 'LOW' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 opacity-70">
                          <span className="flex-shrink-0 w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                          <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{task.title || 'Untitled'}</span>
                          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${pc}`}>{task.priority}</span>
                          {task.required && <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Req</span>}
                          <button type="button" onClick={() => setEditingTaskIdx(i)} className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-500" title="Edit"><PenLine className="w-3.5 h-3.5" /></button>
                        </div>
                      )
                    }
                    return (
                      <SortableRow key={i} id={String(i)} index={i} onRemove={() => removeTask(i)}
                        onEdit={() => setEditingTaskIdx(i)} priority={task.priority} required={task.required} title={task.title} />
                    )
                  })
                  if (isSearching) return <div className="space-y-2">{taskRows}</div>
                  return (
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
                      <SortableContext items={filtered.map(({ i }) => String(i))} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">{taskRows}</div>
                      </SortableContext>
                    </DndContext>
                  )
                })()}
                <button type="button" onClick={addTask} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add task
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Task edit slide-over panel */}
      {editingTaskIdx !== null && editingTaskIdx < editTasks.length && (
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
                <input type="text" value={editTasks[editingTaskIdx].title} onChange={e => updateTask(editingTaskIdx, 'title', e.target.value)} placeholder="e.g. Check belt tension" className="input-field w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <textarea value={editTasks[editingTaskIdx].description} onChange={e => updateTask(editingTaskIdx, 'description', e.target.value)} placeholder="Optional description for this task" rows={3} className="input-field w-full text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</label>
                  <select value={editTasks[editingTaskIdx].priority} onChange={e => updateTask(editingTaskIdx, 'priority', e.target.value)} className="input-field w-full">
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Required</label>
                  <button type="button" onClick={() => updateTask(editingTaskIdx, 'required', !editTasks[editingTaskIdx].required)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors w-full">
                    <span className={`w-9 h-5 rounded-full relative transition-colors ${editTasks[editingTaskIdx].required ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                      <span className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform ${editTasks[editingTaskIdx].required ? 'translate-x-4' : ''}`} />
                    </span>
                    <span className={`text-xs font-bold uppercase ${editTasks[editingTaskIdx].required ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {editTasks[editingTaskIdx].required ? 'Required' : 'Optional'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned User</label>
                <select value={editTasks[editingTaskIdx].assignedToId} onChange={e => updateTask(editingTaskIdx, 'assignedToId', e.target.value)} className="input-field w-full">
                  <option value="">-- Unassigned --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Team</label>
                <select value={editTasks[editingTaskIdx].assignedTeamId} onChange={e => updateTask(editingTaskIdx, 'assignedTeamId', e.target.value)} className="input-field w-full">
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

      {/* Import modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[100] flex sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { if (!importing) setImportModalOpen(false) }} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl sm:mx-4 h-full sm:h-auto sm:max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{importResult ? 'Import Complete' : `Import (${importPreview.length})`}</h2>
              <button onClick={() => { if (!importing) setImportModalOpen(false) }} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {importResult ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-emerald-600">{importResult.success}</span> template{importResult.success !== 1 ? 's' : ''} imported
                    {importResult.failed > 0 && <>&middot; <span className="font-semibold text-red-600">{importResult.failed}</span> failed</>}
                  </p>
                  <button onClick={() => { setImportModalOpen(false); setImportResult(null) }} className="btn-primary text-sm">Done</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">Rows with the same <code className="bg-gray-100 px-1 rounded">template_name</code> are grouped into one template.</p>
                  {importPreview.map((tpl, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{tpl.name}</p>
                          {tpl.description && <p className="text-xs text-gray-500 truncate">{tpl.description}</p>}</div>
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0">{tpl.tasks.length} task{tpl.tasks.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {tpl.tasks.map((task, j) => (
                          <div key={j} className="px-3 sm:px-4 py-2 flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-bold w-4 text-center flex-shrink-0">{j + 1}</span>
                            <span className="text-gray-900 font-medium flex-1 min-w-0 truncate">{task.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${
                              task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                              task.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                            }`}>{task.priority}</span>
                            <span className={`flex-shrink-0 ${task.required ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>{task.required ? 'Req' : 'Opt'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!importResult && (
              <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
                <button onClick={() => setImportModalOpen(false)} disabled={importing} className="btn-secondary text-sm disabled:opacity-50">Cancel</button>
                <button onClick={confirmImport} disabled={importing} className="btn-primary text-sm disabled:opacity-50">{importing ? 'Importing...' : `Import ${importPreview.length}`}</button>
              </div>
            )}
            <div className="hidden sm:flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={downloadSample} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium">
                <Download className="w-3.5 h-3.5" /> Download sample .xlsx
              </button>
              <span className="text-[11px] text-gray-400">Columns: template_name, template_description, task_title, task_description, task_priority, task_assigned_to, task_assigned_team, task_required</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
