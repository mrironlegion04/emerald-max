'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Circle, AlertCircle, Trash2, Plus, Edit2, X, Search, LayoutGrid, List } from 'lucide-react'
import { fmtCurrency } from '@/lib/utils'
import { isOverdueByDate, todayUTC, utcDateOnly, fmtDateOnly } from '@/lib/date-format'

interface Subtask {
  id: string
  title: string
  description: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  required: boolean
  completionType: 'ASSIGNED' | 'ADMIN_OVERRIDE' | 'MANAGER_OVERRIDE' | null
  remarks: string | null
  assignedTo: { id: string; name: string; email: string } | null
  assignedTeam: { id: string; name: string } | null
  completedBy: { id: string; name: string; email: string } | null
  createdBy: { id: string; name: string } | null
  workOrderId: string
}

interface User {
  id: string
  name: string
  email: string
}

interface Team {
  id: string
  name: string
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const priorityColors: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
}

export default function SubtasksPanel({
  woId,
  initialSubtasks = [],
  woStatus,
  allUsers = [],
  allTeams = [],
  canEdit = false,
  currentUserId = '',
  isManagerOrAbove = false,
}: {
  woId: string
  initialSubtasks?: Subtask[]
  woStatus: string
  allUsers?: User[]
  allTeams?: Team[]
  canEdit?: boolean
  currentUserId?: string
  isManagerOrAbove?: boolean
}) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all')
  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(new Set())
  const [editingRemarksId, setEditingRemarksId] = useState<string | null>(null)
  const [remarksDraft, setRemarksDraft] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    assignedToId: '',
    assignedTeamId: '',
    required: true,
    remarks: '',
  })

  // Load subtasks from API if not provided
  useEffect(() => {
    if (initialSubtasks.length === 0) {
      fetchSubtasks()
    }
  }, [woId])

  const fetchSubtasks = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/subtasks?workOrderId=${woId}`)
      if (res.ok) {
        const data = await res.json()
        setSubtasks(data)
      }
    } catch (error) {
      console.error('Failed to fetch subtasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)

      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        dueDate: formData.dueDate || null,
        workOrderId: woId,
        assignedToId: formData.assignedToId || null,
        assignedTeamId: formData.assignedTeamId || null,
        required: formData.required,
        remarks: formData.remarks || null,
      }

      if (editingId) {
        // Update
        const res = await fetch(`/api/subtasks/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const updated = await res.json()
          setSubtasks(subtasks.map(s => (s.id === editingId ? updated : s)))
          resetForm()
        }
      } else {
        // Create
        const res = await fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const newSubtask = await res.json()
          setSubtasks([newSubtask, ...subtasks])
          resetForm()
        }
      }
    } catch (error) {
      console.error('Failed to save subtask:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) return

    try {
      const res = await fetch(`/api/subtasks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSubtasks(subtasks.filter(s => s.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete subtask:', error)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/subtasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSubtasks(subtasks.map(s => (s.id === id ? updated : s)))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to update subtask status')
      }
    } catch (err) {
      console.error('Failed to update subtask status:', err)
      setError('Failed to update subtask status')
    }
  }

  const canComplete = (subtask: Subtask) => {
    if (!canEdit) return false
    if (isManagerOrAbove) return true
    if (!subtask.assignedTo && !subtask.assignedTeam) return true
    if (subtask.assignedTo) return subtask.assignedTo.id === currentUserId
    return true
  }

  const handleEdit = (subtask: Subtask) => {
    setFormData({
      title: subtask.title,
      description: subtask.description || '',
      priority: subtask.priority,
      dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().split('T')[0] : '',
      assignedToId: subtask.assignedTo?.id || '',
      assignedTeamId: subtask.assignedTeam?.id || '',
      required: subtask.required,
      remarks: subtask.remarks || '',
    })
    setEditingId(subtask.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      assignedToId: '',
      assignedTeamId: '',
      required: true,
      remarks: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleRemarksSave = async (id: string) => {
    try {
      const res = await fetch(`/api/subtasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: remarksDraft || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSubtasks(subtasks.map(s => (s.id === id ? updated : s)))
      }
    } catch (error) {
      console.error('Failed to save remarks:', error)
    }
    setEditingRemarksId(null)
  }

  const completedCount = subtasks.filter(s => s.status === 'COMPLETED').length
  const totalCount = subtasks.length

  const filteredSubtasks = subtasks.filter(s => {
    if (filterTab === 'pending' && s.status === 'COMPLETED') return false
    if (filterTab === 'completed' && s.status !== 'COMPLETED') return false
    if (search) {
      const q = search.toLowerCase()
      return s.title.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const toggleCompletedExpand = (id: string) => {
    setExpandedCompleted(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-805 text-sm tracking-tight">Subtasks</h2>
          <p className="text-xs text-slate-450 mt-1 font-medium">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Card view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Table view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {canEdit && woStatus !== 'COMPLETED' && woStatus !== 'CANCELLED' && woStatus !== 'CLOSED' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 border-slate-200 font-bold hover:bg-slate-50 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add subtask
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-5 p-4 sm:p-5 bg-slate-50 border border-slate-200/60 rounded-xl shadow-inner-light">
          <form onSubmit={handleAddOrUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Replace pump seal"
                className="input-field text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description..."
                className="input-field text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  className="input-field text-sm bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="input-field text-sm bg-white cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assign to User
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
                  className="input-field text-sm bg-white"
                >
                  <option value="">Select user...</option>
                  {allUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assign to Team
                </label>
                <select
                  value={formData.assignedTeamId}
                  onChange={e => setFormData({ ...formData, assignedTeamId: e.target.value })}
                  className="input-field text-sm bg-white"
                >
                  <option value="">Select team...</option>
                  {allTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.required}
                onChange={e => setFormData({ ...formData, required: e.target.checked })}
                className="sr-only peer"
              />
              <span className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full relative transition-colors peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4"></span>
              <span className="text-xs font-bold text-slate-700">
                Required — {formData.required
                  ? 'must be completed before the work order can be closed'
                  : 'optional; does not block work order completion'}
              </span>
            </label>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Optional notes — what was found, done, or observed..."
                className="input-field text-sm resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-xs py-2 px-4 shadow-sm font-bold flex-1"
              >
                {editingId ? 'Update' : 'Create'} subtask
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary text-xs py-2 px-4 border-slate-200 font-bold flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
      )}

      {/* Search + Filter Tabs */}
      {totalCount > 0 && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subtasks..."
              className="input-field pl-9 text-sm w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            {(['all', 'pending', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filterTab === tab
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'pending' ? 'Pending' : 'Completed'}
                <span className="ml-1 text-[10px] text-slate-400">
                  ({tab === 'all' ? totalCount : tab === 'pending' ? totalCount - completedCount : completedCount})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtasks List */}
      {loading && totalCount === 0 ? (
        <div className="text-center py-10">
          <p className="text-xs text-slate-400 font-medium">Loading subtasks...</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-10 bg-slate-50/20 border border-dashed border-slate-200 rounded-xl">
          <p className="text-xs text-slate-400 font-semibold mb-1">No subtasks added yet</p>
          <p className="text-[11px] text-slate-400">Add smaller checklist tasks or subtasks for technicians.</p>
        </div>
      ) : filteredSubtasks.length === 0 ? (
        <div className="text-center py-10 bg-slate-50/20 border border-dashed border-slate-200 rounded-xl">
          <p className="text-xs text-slate-400 font-semibold">No subtasks match your search</p>
        </div>
      ) : viewMode === 'card' ? (
        /* ── Card View ── */
        <div className="max-h-[40rem] overflow-y-auto -mx-1 px-1 space-y-3">
          {filteredSubtasks.map(subtask => {
            const isOverdue =
              subtask.dueDate &&
              isOverdueByDate(subtask.dueDate, todayUTC()) &&
              subtask.status !== 'COMPLETED'
            const isCompleted = subtask.status === 'COMPLETED'
            const isCollapsed = isCompleted && !expandedCompleted.has(subtask.id)

            return (
              <div
                key={subtask.id}
                className={`group p-3.5 border rounded-xl hover:bg-slate-50/20 hover:border-slate-350/50 transition duration-150 ${
                  isCompleted
                    ? 'border-slate-100 bg-slate-50/10 opacity-75'
                    : 'border-slate-200/60 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status button */}
                  <button
                    onClick={() => {
                      if (isCompleted) {
                        handleStatusChange(subtask.id, 'PENDING')
                      } else {
                        handleStatusChange(subtask.id, 'COMPLETED')
                      }
                    }}
                    disabled={!canComplete(subtask)}
                    title={
                      !canComplete(subtask) && subtask.assignedTo
                        ? `Assigned to ${subtask.assignedTo.name}`
                        : undefined
                    }
                    className={`flex-shrink-0 mt-0.5 transition-transform ${
                      canComplete(subtask) ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {/* Collapsed completed subtask: title only */}
                        {isCollapsed ? (
                          <button
                            onClick={() => toggleCompletedExpand(subtask.id)}
                            className="flex items-center gap-2 group w-full text-left"
                          >
                            <p className="text-sm font-semibold tracking-tight line-through text-slate-400">
                              {subtask.title}
                            </p>
                            <span className="text-[10px] text-slate-300 group-hover:text-slate-500 transition-colors">▸ expand</span>
                          </button>
                        ) : (
                          <>
                            <p
                              className={`text-sm font-semibold tracking-tight ${
                                isCompleted
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800'
                              }`}
                            >
                              {subtask.title}
                              {isCompleted && (
                                <button
                                  onClick={() => toggleCompletedExpand(subtask.id)}
                                  className="ml-2 text-[10px] text-slate-300 hover:text-slate-500 transition-colors font-normal"
                                >
                                  ▾ collapse
                                </button>
                              )}
                            </p>

                            {subtask.description && (
                              <p className={`text-xs mt-1.5 whitespace-pre-wrap leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
                                {subtask.description}
                              </p>
                            )}

                            {/* Remarks */}
                            {editingRemarksId === subtask.id ? (
                              <div className="mt-2">
                                <textarea
                                  autoFocus
                                  value={remarksDraft}
                                  onChange={e => setRemarksDraft(e.target.value)}
                                  placeholder="What was found, done, or observed..."
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg resize-none focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300"
                                  rows={2}
                                />
                                <div className="flex gap-1.5 mt-1.5">
                                  <button
                                    onClick={() => handleRemarksSave(subtask.id)}
                                    className="text-[10px] font-bold px-2.5 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingRemarksId(null)}
                                    className="text-[10px] font-bold px-2.5 py-1 text-slate-400 hover:text-slate-600 transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : subtask.remarks ? (
                              <button
                                onClick={() => { setEditingRemarksId(subtask.id); setRemarksDraft(subtask.remarks || '') }}
                                className="mt-2 block w-full text-left group"
                              >
                                <span className="text-[11px] italic text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap block group-hover:bg-slate-100/80 transition">
                                  💬 {subtask.remarks}
                                </span>
                              </button>
                            ) : canEdit && (
                              <button
                                onClick={() => { setEditingRemarksId(subtask.id); setRemarksDraft('') }}
                                className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 transition lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                + Add remarks
                              </button>
                            )}

                            {/* Metadata row */}
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : subtask.status === 'IN_PROGRESS'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : subtask.status === 'CANCELLED'
                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                    : 'bg-slate-100 text-slate-650 border-slate-200'
                                }`}
                              >
                                {statusLabels[subtask.status]}
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  subtask.priority === 'CRITICAL'
                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                    : subtask.priority === 'HIGH'
                                    ? 'bg-orange-50 text-orange-700 border-orange-100'
                                    : subtask.priority === 'MEDIUM'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-emerald-50 text-emerald-750 border-emerald-100'
                                }`}
                              >
                                <span className={`w-1 h-1 rounded-full ${
                                  subtask.priority === 'CRITICAL' ? 'bg-rose-500' : subtask.priority === 'HIGH' ? 'bg-orange-500' : subtask.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                {priorityLabels[subtask.priority]}
                              </span>

                              {subtask.dueDate && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isOverdue ? 'bg-rose-50 text-rose-700 border-rose-100/60' : 'bg-slate-50 text-slate-500 border-slate-100'
                                  }`}
                                >
                                  📅 Due {fmtDateOnly(utcDateOnly(subtask.dueDate))}
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  subtask.required
                                    ? 'bg-slate-50 text-slate-600 border-slate-200'
                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                                }`}
                                title={subtask.required
                                  ? 'Required — must be completed before the work order can be closed'
                                  : 'Optional — does not block work order completion'}
                              >
                                {subtask.required ? '◆ Required' : '◇ Optional'}
                              </span>

                              {subtask.assignedTeam && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-bold">
                                  👥 {subtask.assignedTeam.name}
                                </span>
                              )}

                              {subtask.assignedTo && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-bold">
                                  👤 {subtask.assignedTo.name}
                                </span>
                              )}

                              {subtask.completedBy && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/85 rounded-full text-[10px] font-bold">
                                  ✓ {subtask.completedBy.name}
                                </span>
                              )}

                              {isCompleted && subtask.completionType && subtask.completionType !== 'ASSIGNED' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/70 rounded-full text-[10px] font-bold">
                                  🛡️ {subtask.completionType === 'ADMIN_OVERRIDE' ? 'Admin override' : 'Manager override'}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Edit/Delete buttons */}
                      {canEdit && (
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => handleEdit(subtask)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(subtask.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <div className="max-h-[40rem] overflow-y-auto -mx-1 px-1">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 pr-2 w-8"></th>
                <th className="pb-2 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title</th>
                <th className="pb-2 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Priority</th>
                <th className="pb-2 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Assignee</th>
                <th className="pb-2 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Due</th>
                <th className="pb-2 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Remarks</th>
                {canEdit && <th className="pb-2 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {filteredSubtasks.map(subtask => {
                const isCompleted = subtask.status === 'COMPLETED'
                const isOverdue =
                  subtask.dueDate &&
                  isOverdueByDate(subtask.dueDate, todayUTC()) &&
                  !isCompleted
                const isEditingRemarks = editingRemarksId === subtask.id
                const assignee = subtask.assignedTo?.name || subtask.assignedTeam?.name || null

                return (
                  <tr
                    key={subtask.id}
                    className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50"
                  >
                    {/* Status */}
                    <td className="py-2.5 pr-2">
                      <button
                        onClick={() => handleStatusChange(subtask.id, isCompleted ? 'PENDING' : 'COMPLETED')}
                        disabled={!canComplete(subtask)}
                        className={`flex-shrink-0 transition-transform ${canComplete(subtask) ? 'hover:scale-110 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 hover:text-blue-500" />
                        )}
                      </button>
                    </td>

                    {/* Title + description */}
                    <td className="py-2.5 pr-3 min-w-0">
                      <p className="text-xs font-semibold truncate text-slate-800">
                        {subtask.title}
                      </p>
                      {subtask.description && (
                        <p className={`text-[11px] mt-0.5 truncate leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
                          {subtask.description}
                        </p>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 pr-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        subtask.priority === 'CRITICAL' ? 'text-rose-600' :
                        subtask.priority === 'HIGH' ? 'text-orange-600' :
                        subtask.priority === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          subtask.priority === 'CRITICAL' ? 'bg-rose-500' :
                          subtask.priority === 'HIGH' ? 'bg-orange-500' :
                          subtask.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        {priorityLabels[subtask.priority]}
                      </span>
                    </td>

                    {/* Assignee */}
                    <td className="py-2.5 pr-3 hidden md:table-cell">
                      {assignee ? (
                        <span className="text-[11px] text-slate-600 font-medium truncate block max-w-[8rem]">
                          {assignee}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>

                    {/* Due */}
                    <td className="py-2.5 pr-3 hidden lg:table-cell">
                      {subtask.dueDate ? (
                        <span className={`text-[11px] font-medium whitespace-nowrap ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                          {fmtDateOnly(utcDateOnly(subtask.dueDate))}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className="py-2.5 pr-3 hidden md:table-cell min-w-0">
                      {isEditingRemarks ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            value={remarksDraft}
                            onChange={e => setRemarksDraft(e.target.value)}
                            placeholder="Add note..."
                            className="flex-1 min-w-0 text-[11px] px-2 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleRemarksSave(subtask.id)
                              }
                              if (e.key === 'Escape') setEditingRemarksId(null)
                            }}
                          />
                          <button onClick={() => handleRemarksSave(subtask.id)} className="text-[10px] font-bold px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap">Save</button>
                        </div>
                      ) : subtask.remarks ? (
                        <button
                          onClick={() => { setEditingRemarksId(subtask.id); setRemarksDraft(subtask.remarks || '') }}
                          className="text-[11px] italic text-slate-400 hover:text-slate-600 truncate max-w-[12rem] block text-left transition"
                          title={subtask.remarks}
                        >
                          💬 {subtask.remarks}
                        </button>
                      ) : canEdit ? (
                        <button
                          onClick={() => { setEditingRemarksId(subtask.id); setRemarksDraft('') }}
                          className="text-[10px] text-slate-300 hover:text-slate-500 transition"
                        >
                          + remarks
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>

                    {/* Required + Actions */}
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {!subtask.required && (
                          <span className="text-[9px] text-slate-300 font-bold" title="Optional">○</span>
                        )}
                        {canEdit && (
                          <>
                            <button onClick={() => handleEdit(subtask)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition" title="Edit">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(subtask.id)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition" title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
