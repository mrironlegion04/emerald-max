'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Circle, AlertCircle, Trash2, Plus, Edit2, X } from 'lucide-react'
import { fmt, fmtCurrency } from '@/lib/utils'

interface Subtask {
  id: string
  title: string
  description: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  assignedTo: { id: string; name: string; email: string } | null
  assignedDomain: { id: string; name: string } | null
  completedBy: { id: string; name: string; email: string } | null
  createdBy: { id: string; name: string } | null
  workOrderId: string
}

interface User {
  id: string
  name: string
  email: string
}

interface Domain {
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
  allDomains = [],
  canEdit = false,
}: {
  woId: string
  initialSubtasks?: Subtask[]
  woStatus: string
  allUsers?: User[]
  allDomains?: Domain[]
  canEdit?: boolean
}) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    assignedToId: '',
    assignedDomainId: '',
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

      // Validate: can't assign to both user and domain
      if (formData.assignedToId && formData.assignedDomainId) {
        alert('Assign to either a domain or an individual, not both')
        setLoading(false)
        return
      }

      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        dueDate: formData.dueDate || null,
        workOrderId: woId,
        assignedToId: formData.assignedDomainId ? null : (formData.assignedToId || null),
        assignedDomainId: formData.assignedDomainId || null,
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
    try {
      const res = await fetch(`/api/subtasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSubtasks(subtasks.map(s => (s.id === id ? updated : s)))
      }
    } catch (error) {
      console.error('Failed to update subtask status:', error)
    }
  }

  const handleEdit = (subtask: Subtask) => {
    setFormData({
      title: subtask.title,
      description: subtask.description || '',
      priority: subtask.priority,
      dueDate: subtask.dueDate ? new Date(subtask.dueDate).toISOString().split('T')[0] : '',
      assignedToId: subtask.assignedTo?.id || '',
      assignedDomainId: subtask.assignedDomain?.id || '',
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
      assignedDomainId: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const completedCount = subtasks.filter(s => s.status === 'COMPLETED').length
  const totalCount = subtasks.length

  return (
    <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-805 text-sm tracking-tight">Subtasks</h2>
          <p className="text-xs text-slate-450 mt-1 font-medium">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        {canEdit && woStatus !== 'COMPLETED' && woStatus !== 'CANCELLED' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 border-slate-200 font-bold hover:bg-slate-50 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add subtask
          </button>
        )}
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
                  disabled={formData.assignedDomainId ? true : false}
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
                  Assign to Domain
                </label>
                <select
                  value={formData.assignedDomainId}
                  onChange={e => setFormData({ ...formData, assignedDomainId: e.target.value })}
                  className="input-field text-sm bg-white"
                  disabled={formData.assignedToId ? true : false}
                >
                  <option value="">Select domain...</option>
                  {allDomains.map(domain => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </div>
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
      ) : (
        <div className="space-y-3">
          {subtasks.map(subtask => {
            const isOverdue =
              subtask.dueDate &&
              new Date(subtask.dueDate) < new Date() &&
              subtask.status !== 'COMPLETED'

            return (
              <div
                key={subtask.id}
                className={`p-3.5 border rounded-xl hover:bg-slate-50/20 hover:border-slate-350/50 transition duration-150 ${
                  subtask.status === 'COMPLETED'
                    ? 'border-slate-100 bg-slate-50/10 opacity-75'
                    : 'border-slate-200/60 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status button */}
                  <button
                    onClick={() => {
                      if (subtask.status === 'COMPLETED') {
                        handleStatusChange(subtask.id, 'PENDING')
                      } else {
                        handleStatusChange(subtask.id, 'COMPLETED')
                      }
                    }}
                    className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    {subtask.status === 'COMPLETED' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold tracking-tight ${
                            subtask.status === 'COMPLETED'
                              ? 'line-through text-slate-400'
                              : 'text-slate-800'
                          }`}
                        >
                          {subtask.title}
                        </p>

                        {subtask.description && (
                          <p className={`text-xs mt-1.5 whitespace-pre-wrap leading-relaxed ${subtask.status === 'COMPLETED' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {subtask.description}
                          </p>
                        )}

                        {/* Metadata row */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              subtask.status === 'COMPLETED'
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
                              📅 Due {fmt(subtask.dueDate)}
                            </span>
                          )}

                          {subtask.assignedDomain && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-bold">
                              👥 {subtask.assignedDomain.name}
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
                        </div>
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
      )}
    </div>
  )
}
