'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, ChevronDown, ChevronRight, Check, X, Trash2, Edit3, Users as UsersIcon } from 'lucide-react'
import PageHeader from './PageHeader'
import { PERMISSION_GROUPS } from '@/lib/permissions'
import type { Permission } from '@/lib/permissions'

interface CustomRole {
  id: string
  name: string
  description: string | null
  permissions: string[]
  isActive: boolean
  userCount: number
  createdAt: string
}

export default function RolesManager() {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] })
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles')
      if (res.ok) {
        setRoles(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const togglePermission = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }))
  }

  const toggleGroupPermissions = (groupKey: string) => {
    const group = PERMISSION_GROUPS[groupKey]
    if (!group) return
    const allSelected = group.permissions.every(p => form.permissions.includes(p as string))
    setForm(f => ({
      ...f,
      permissions: allSelected
        ? f.permissions.filter(p => !group.permissions.includes(p as Permission))
        : [...new Set([...f.permissions, ...group.permissions])],
    }))
  }

  const startEdit = (role: CustomRole) => {
    setEditingRole(role)
    setForm({ name: role.name, description: role.description ?? '', permissions: role.permissions })
    setShowForm(true)
    setError(null)
  }

  const startCreate = () => {
    setEditingRole(null)
    setForm({ name: '', description: '', permissions: [] })
    setShowForm(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Role name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles'
      const method = editingRole ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      setShowForm(false)
      setEditingRole(null)
      await fetchRoles()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId)
    if (role?.userCount && role.userCount > 0) {
      setError(`Cannot delete "${role.name}" — ${role.userCount} user(s) are assigned to it.`)
      return
    }
    if (!confirm('Delete this role? This cannot be undone.')) return
    setDeleting(roleId)
    try {
      const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to delete'); return }
      await fetchRoles()
    } finally {
      setDeleting(null)
    }
  }

  const getPermCount = (groupKey: string) => {
    const group = PERMISSION_GROUPS[groupKey]
    if (!group) return { selected: 0, total: 0 }
    const selected = group.permissions.filter(p => form.permissions.includes(p as string)).length
    return { selected, total: group.permissions.length }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Custom Roles"
        subtitle={`Define granular permission sets. ${roles.length} role(s) configured.`}
        action={
          <button onClick={startCreate} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Role
          </button>
        }
      />

      {/* Role Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingRole ? `Edit: ${editingRole.name}` : 'New Custom Role'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingRole(null) }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Senior Technician"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Permissions ({form.permissions.length} selected)
                </div>
                <div className="space-y-2">
                  {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
                    const { selected, total } = getPermCount(groupKey)
                    const isExpanded = expandedGroups.has(groupKey)
                    const allSelected = selected === total && total > 0

                    return (
                      <div key={groupKey} className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <span className="text-sm font-medium text-slate-800 flex-1">{group.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${allSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {selected}/{total}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); toggleGroupPermissions(groupKey) }}
                            className={`text-xs px-2 py-1 rounded ${allSelected ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`}
                          >
                            {allSelected ? 'None' : 'All'}
                          </button>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {group.permissions.map(perm => {
                              const checked = form.permissions.includes(perm as string)
                              return (
                                <button
                                  key={perm}
                                  onClick={() => togglePermission(perm as string)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    checked
                                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  {checked ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 border border-slate-300 rounded" />}
                                  {perm}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-slate-50">
              <button
                onClick={() => { setShowForm(false); setEditingRole(null) }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Cards */}
      {roles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No custom roles yet</p>
          <p className="text-sm text-slate-400 mt-1">Create a role to define a custom set of permissions</p>
          <button onClick={startCreate} className="mt-4 btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create First Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(role => (
            <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{role.name}</h3>
                    {role.description && <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {role.permissions.slice(0, 6).map(p => (
                  <span key={p} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {p}
                  </span>
                ))}
                {role.permissions.length > 6 && (
                  <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                    +{role.permissions.length - 6} more
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <UsersIcon className="w-3.5 h-3.5" />
                  {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(role)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    disabled={deleting === role.id || role.userCount > 0}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 disabled:opacity-30"
                    title={role.userCount > 0 ? 'Reassign users first' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
