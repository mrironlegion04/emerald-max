'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, RotateCcw, X, ClipboardList, Search, Upload, Download } from 'lucide-react'
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

  const csvInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<{ name: string; description: string; tasks: TaskTemplateTask[] }[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)

  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d.map((u: any) => ({ id: u.id, name: u.name })) : [])).catch(() => {})
    fetch('/api/teams').then(r => r.ok ? r.json() : []).then(d => setTeams(Array.isArray(d) ? d.map((t: any) => ({ id: t.id, name: t.name })) : [])).catch(() => {})
  }, [])

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

  function downloadSample() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['template_name', 'template_description', 'task_title', 'task_description', 'task_priority', 'task_assigned_to', 'task_assigned_team', 'task_required'],
      ['HVAC Safety Checklist', 'Monthly HVAC safety inspection', 'Check belt tension', 'Inspect and adjust tension', '', 'Ankit Mehta', '', 'yes'],
      ['', '', 'Lubricate bearings', '', 'medium', '', 'Maintenance Team', 'yes'],
      ['', '', 'Replace worn seals', 'Check seal condition', 'high', '', 'Mechanical', 'no'],
      ['Electrical Inspection', 'Quarterly electrical checks', 'Test circuit breakers', 'Verify all breakers trip correctly', 'high', '', 'Electrical', 'yes'],
      ['', '', 'Inspect wiring', 'Look for frayed or damaged wires', '', '', '', 'yes'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Templates')
    XLSX.writeFile(wb, 'task-templates-sample.xlsx')
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = () => {
        const wb = XLSX.read(String(reader.result ?? ''), { type: 'string' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        processImportRows(rows)
      }
      reader.readAsText(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = () => {
        const wb = XLSX.read(reader.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        processImportRows(rows)
      }
      reader.readAsArrayBuffer(file)
    } else {
      setImportResult(null)
      setImportPreview([])
      alert('Unsupported file type. Please upload a .csv or .xlsx file.')
    }
  }

  function processImportRows(rows: Record<string, unknown>[]) {
    setImportResult(null)
    if (rows.length === 0) { alert('No rows found in the file.'); return }
    const normalized = rows.map(row => {
      const obj: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        obj[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim()
      }
      return obj
    })

    const templateMap = new Map<string, { name: string; description: string; tasks: TaskTemplateTask[] }>()
    let lastTemplateName = ''
    for (const row of normalized) {
      const templateName = (row.template_name ?? '').trim() || lastTemplateName
      if (!templateName) continue
      lastTemplateName = templateName
      if (!templateMap.has(templateName)) {
        templateMap.set(templateName, {
          name: templateName,
          description: (row.template_description ?? '').trim(),
          tasks: [],
        })
      }
      const taskTitle = (row.task_title ?? row.title ?? '').trim()
      if (!taskTitle) continue
      const tpl = templateMap.get(templateName)!
      tpl.tasks.push({
        title: taskTitle,
        description: (row.task_description ?? row.description ?? '').trim(),
        priority: (row.task_priority ?? row.priority ?? 'MEDIUM').trim().toUpperCase() || 'MEDIUM',
        assignedToId: '',
        assignedTeamId: '',
        required: (row.task_required ?? row.required ?? 'yes').trim().toLowerCase() !== 'no',
      })
    }

    const parsed = Array.from(templateMap.values()).filter(t => t.tasks.length > 0)
    setImportPreview(parsed)
    setImportModalOpen(true)
  }

  async function confirmImport() {
    setImporting(true)
    setImportResult(null)
    let success = 0
    let failed = 0
    for (const tpl of importPreview) {
      try {
        const res = await fetch('/api/task-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tpl.name,
            description: tpl.description || null,
            tasks: tpl.tasks.map(t => ({
              title: t.title,
              description: t.description || null,
              priority: t.priority,
              assignedToId: null,
              assignedTeamId: null,
              required: t.required,
            })),
          }),
        })
        if (res.ok) success++
        else failed++
      } catch { failed++ }
    }
    setImportResult({ success, failed })
    setImporting(false)
    if (success > 0) router.refresh()
  }

  const hasAnyTemplates = templates.length > 0 || archivedTemplates.length > 0
  const isSearching = search.trim().length > 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search + Actions */}
      <div className="space-y-3">
        <div className="relative group">
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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Template
          </button>
          <button onClick={() => csvInputRef.current?.click()} className="btn-secondary text-sm flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={downloadSample} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Sample
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* Archived toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input type="checkbox" checked={showDeleted} onChange={toggleShowDeleted}
          className="w-4 h-4 text-red-600 rounded border-gray-300" />
        Show archived
      </label>

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
            <div key={t.id} className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}
                    {t._count.pmSchedules > 0 && ` \u00b7 linked to ${t._count.pmSchedules} PM${t._count.pmSchedules !== 1 ? 's' : ''}`}
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

      {/* Archived templates */}
      {showDeleted && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          <div className="px-4 py-2 sm:px-5 bg-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Archived
              {filteredArchived.length > 0 && ` \u00b7 ${filteredArchived.length}`}
            </p>
          </div>
          {loadingArchived ? (
            <div className="px-4 py-4 sm:px-5">
              <p className="text-xs text-gray-400">Loading archived\u2026</p>
            </div>
          ) : filteredArchived.length === 0 ? (
            <div className="px-4 py-4 sm:px-5">
              <p className="text-xs text-gray-400">
                {isSearching ? `No archived templates match \u201c${search}\u201d` : 'No archived templates.'}
              </p>
            </div>
          ) : (
            filteredArchived.map(t => (
              <div key={t.id} className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-400 line-through truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}
                      {t._count.pmSchedules > 0 && ` \u00b7 linked to ${t._count.pmSchedules} PM${t._count.pmSchedules !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge label="Archived" variant="red" />
                    <button onClick={() => handleRestore(t.id)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit/Create modal - full-screen on mobile */}
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
                    {/* Row 1: number + title */}
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                      <input type="text" value={task.title} onChange={e => updateTask(i, 'title', e.target.value)}
                        placeholder="Task title" className="input-field flex-1 text-sm min-w-0" />
                    </div>
                    {/* Row 2: priority + required + actions */}
                    <div className="flex items-center gap-2 pl-7">
                      <select value={task.priority} onChange={e => updateTask(i, 'priority', e.target.value)}
                        className="input-field w-24 sm:w-28 text-xs">
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
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                        <button type="button" onClick={() => moveTask(i, -1)} disabled={i === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => moveTask(i, 1)} disabled={i === editTasks.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => removeTask(i)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Row 3: description */}
                    <div className="pl-7">
                      <input type="text" value={task.description} onChange={e => updateTask(i, 'description', e.target.value)}
                        placeholder="Optional description" className="input-field w-full text-xs" />
                    </div>
                    {/* Row 4: user + team */}
                    <div className="flex items-center gap-2 pl-7">
                      <select value={task.assignedToId} onChange={e => updateTask(i, 'assignedToId', e.target.value)}
                        className="input-field text-xs flex-1 min-w-0">
                        <option value="">-- User --</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <select value={task.assignedTeamId} onChange={e => updateTask(i, 'assignedTeamId', e.target.value)}
                        className="input-field text-xs flex-1 min-w-0">
                        <option value="">-- Team --</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addTask} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add task
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary text-sm disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import preview modal - full-screen on mobile */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[100] flex sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { if (!importing) setImportModalOpen(false) }} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl sm:mx-4 h-full sm:h-auto sm:max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">
                {importResult ? 'Import Complete' : `Import (${importPreview.length})`}
              </h2>
              <button onClick={() => { if (!importing) setImportModalOpen(false) }} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {importResult ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-emerald-600">{importResult.success}</span> template{importResult.success !== 1 ? 's' : ''} imported
                    {importResult.failed > 0 && (
                      <> \u00b7 <span className="font-semibold text-red-600">{importResult.failed}</span> failed</>
                    )}
                  </p>
                  <button onClick={() => { setImportModalOpen(false); setImportResult(null) }}
                    className="btn-primary text-sm">Done</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Rows with the same <code className="bg-gray-100 px-1 rounded">template_name</code> are grouped into one template.
                  </p>
                  {importPreview.map((tpl, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{tpl.name}</p>
                          {tpl.description && <p className="text-xs text-gray-500 truncate">{tpl.description}</p>}
                        </div>
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0">{tpl.tasks.length} task{tpl.tasks.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {tpl.tasks.map((task, j) => (
                          <div key={j} className="px-3 sm:px-4 py-2 flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-bold w-4 text-center flex-shrink-0">{j + 1}</span>
                            <span className="text-gray-900 font-medium flex-1 min-w-0 truncate">{task.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${
                              task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                              task.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>{task.priority}</span>
                            <span className={`flex-shrink-0 ${task.required ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                              {task.required ? 'Req' : 'Opt'}
                            </span>
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
                <button onClick={() => setImportModalOpen(false)} disabled={importing}
                  className="btn-secondary text-sm disabled:opacity-50">Cancel</button>
                <button onClick={confirmImport} disabled={importing}
                  className="btn-primary text-sm disabled:opacity-50">
                  {importing ? 'Importing...' : `Import ${importPreview.length}`}
                </button>
              </div>
            )}
            <div className="hidden sm:flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={downloadSample}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium">
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
