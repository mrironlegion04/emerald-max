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
  assignedTeam: { id: string; name: string; trade: string } | null
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
  trade: string
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
}: {
  woId: string
  initialSubtasks?: Subtask[]
  woStatus: string
  allUsers?: User[]
  allTeams?: Team[]
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
    assignedTeamId: '',
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

      // Validate: can't assign to both user and team
      if (formData.assignedToId && formData.assignedTeamId) {
        alert('Assign to either a team or an individual, not both')
        setLoading(false)
        return
      }

      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        dueDate: formData.dueDate || null,
        workOrderId: woId,
        assignedToId: formData.assignedTeamId ? null : (formData.assignedToId || null),
        assignedTeamId: formData.assignedTeamId || null,
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
      assignedTeamId: subtask.assignedTeam?.id || '',
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
    })
    setEditingId(null)
    setShowForm(false)
  }

  const completedCount = subtasks.filter(s => s.status === 'COMPLETED').length
  const totalCount = subtasks.length

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Subtasks</h2>
          <p className="text-xs text-gray-400 mt-1">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        {canEdit && woStatus !== 'COMPLETED' && woStatus !== 'CANCELLED' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add subtask
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <form onSubmit={handleAddOrUpdate} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Replace pump seal"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign to User
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  disabled={formData.assignedTeamId ? true : false}
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign to Team
                </label>
                <select
                  value={formData.assignedTeamId}
                  onChange={e => setFormData({ ...formData, assignedTeamId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  disabled={formData.assignedToId ? true : false}
                >
                  <option value="">Select team...</option>
                  {allTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.trade})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-sm flex-1"
              >
                {editingId ? 'Update' : 'Create'} subtask
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary text-sm flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtasks List */}
      {loading && totalCount === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">Loading subtasks...</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">No subtasks yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subtasks.map(subtask => {
            const isOverdue =
              subtask.dueDate &&
              new Date(subtask.dueDate) < new Date() &&
              subtask.status !== 'COMPLETED'

            return (
              <div
                key={subtask.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
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
                    className="flex-shrink-0 mt-0.5 hover:opacity-70"
                  >
                    {subtask.status === 'COMPLETED' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            subtask.status === 'COMPLETED'
                              ? 'line-through text-gray-400'
                              : 'text-gray-900'
                          }`}
                        >
                          {subtask.title}
                        </p>

                        {subtask.description && (
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
                            {subtask.description}
                          </p>
                        )}

                        {/* Metadata row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              statusColors[subtask.status]
                            }`}
                          >
                            {statusLabels[subtask.status]}
                          </span>

                          <span
                            className={`text-xs font-medium ${priorityColors[subtask.priority]}`}
                          >
                            {priorityLabels[subtask.priority]} priority
                          </span>

                          {subtask.dueDate && (
                            <span
                              className={`text-xs ${
                                isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                              }`}
                            >
                              {isOverdue ? '⚠ ' : ''}Due {fmt(subtask.dueDate)}
                            </span>
                          )}

                          {subtask.assignedTeam && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                              👥 {subtask.assignedTeam.name} ({subtask.assignedTeam.trade})
                            </span>
                          )}

                          {subtask.assignedTo && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                              👤 {subtask.assignedTo.name}
                            </span>
                          )}

                          {subtask.completedBy && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                              ✓ Completed by {subtask.completedBy.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit/Delete buttons */}
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEdit(subtask)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(subtask.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
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
