'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'

interface User { id: string; name: string; email: string; role: string; isActive?: boolean }
interface TeamMemberData { id: string; user: User }
interface Team { id: string; name: string; trade: string; description: string | null; members: TeamMemberData[]; workOrders?: any[]; isDeleted?: boolean; deletedAt?: string | null; deletedBy?: string | null }

const TRADES = [
  'Electrical', 'HVAC', 'Plumbing', 'Mechanical', 'Carpentry',
  'Painting', 'Welding', 'HVAC Refrigeration', 'General Maintenance',
  'Facilities', 'Safety', 'Quality Assurance', 'Automation',
]

export default function TeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNewTeamForm, setShowNewTeamForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  // Form state
  const [formData, setFormData] = useState({ name: '', trade: '', description: '' })
  const [saving, setSaving] = useState(false)

  // Load teams and users
  useEffect(() => {
    const teamsUrl = showDeleted ? '/api/teams?showDeleted=true' : '/api/teams'
    Promise.all([
      fetch(teamsUrl).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ])
      .then(([teamsData, usersData]) => {
        setTeams(teamsData)
        setAllUsers(usersData.filter((u: User) => u.isActive))
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [showDeleted])

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name || !formData.trade) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const newTeam = await res.json()
      setTeams([...teams, newTeam])
      setFormData({ name: '', trade: '', description: '' })
      setShowNewTeamForm(false)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTeam || !formData.name || !formData.trade) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const updated = await res.json()
      setTeams(teams.map(t => t.id === updated.id ? updated : t))
      setSelectedTeam(updated)
      setEditingTeam(null)
      setFormData({ name: '', trade: '', description: '' })
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveTeam(teamId: string) {
    if (!confirm('Archive this team? All work orders and history will be preserved.')) return
    
    setSaving(true)
    setError('')
    try {
      let res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })

      // Force-confirm if active work orders exist
      if (res.status === 409) {
        const data = await res.json()
        if (data.requiresForce) {
          const msg = `This team has ${data.activeWorkOrders} active work order${data.activeWorkOrders !== 1 ? 's' : ''} assigned.\n\nArchiving will preserve the assignments, but the team will no longer appear as an active option.\n\nAre you sure you want to archive it anyway?`
          if (!confirm(msg)) return

          res = await fetch(`/api/teams/${teamId}?force=true`, { method: 'DELETE' })
        }
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Archive failed')
      }
      
      // Update local state instead of removing
      setTeams(teams.map(t =>
        t.id === teamId ? { ...t, isDeleted: true, deletedAt: new Date().toISOString() } : t
      ))
      if (selectedTeam?.id === teamId) {
        setSelectedTeam({ ...selectedTeam, isDeleted: true } as Team)
      }
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestoreTeam(teamId: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Restore failed')
      }
      
      const restored = await res.json()
      setTeams(teams.map(t => t.id === restored.id ? restored : t))
      setSelectedTeam(restored)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTeam || !selectedUserId) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-member', userId: selectedUserId }),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const updated = await res.json()
      setTeams(teams.map(t => t.id === updated.id ? updated : t))
      setSelectedTeam(updated)
      setSelectedUserId('')
      setShowMemberForm(false)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeam || !confirm('Remove this member from the team?')) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-member', userId }),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const updated = await res.json()
      setTeams(teams.map(t => t.id === updated.id ? updated : t))
      setSelectedTeam(updated)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(team: Team) {
    setEditingTeam(team)
    setFormData({ name: team.name, trade: team.trade, description: team.description || '' })
    setShowNewTeamForm(false)
  }

  function cancelEdit() {
    setEditingTeam(null)
    setShowNewTeamForm(false)
    setFormData({ name: '', trade: '', description: '' })
  }

  const availableUsers = selectedTeam
    ? allUsers.filter(u => !selectedTeam.members.some(m => m.user.id === u.id))
    : []
  const memberCount = selectedTeam?.members.length || 0
  const woCount = selectedTeam?.workOrders?.length || 0

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Teams"
        subtitle={`${teams.length} team${teams.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => { setShowNewTeamForm(true); setEditingTeam(null); setFormData({ name: '', trade: '', description: '' }); }}
            className="btn-primary text-sm"
          >
            + New team
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      {/* Show deleted toggle */}
      <div className="mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={e => { setShowDeleted(e.target.checked); setSelectedTeam(null) }}
            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Show deleted
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {teams.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No teams yet. Create your first team to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {teams.map(team => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedTeam?.id === team.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                    } ${team.isDeleted ? 'opacity-50 bg-red-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-600">{team.trade}</p>
                        {team.description && (
                          <p className="text-xs text-gray-500 mt-1">{team.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {team.isDeleted && (
                            <Badge label="Deleted" variant="red" />
                          )}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                            {team.workOrders?.length || 0} WO{team.workOrders?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {selectedTeam?.id === team.id && (
                        <div className="flex gap-2 ml-4">
                          {!team.isDeleted && (
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(team); }}
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            >
                              Edit
                            </button>
                          )}
                          {!team.isDeleted ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArchiveTeam(team.id); }}
                              className="text-red-600 hover:text-red-700 font-medium text-sm"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRestoreTeam(team.id); }}
                              className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Details */}
        <div>
          {showNewTeamForm || editingTeam ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">
                {editingTeam ? 'Edit team' : 'New team'}
              </h3>
              <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Team name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. Electrical Team"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Trade *</label>
                  <select
                    value={formData.trade}
                    onChange={e => setFormData({ ...formData, trade: e.target.value })}
                    className="input-field text-sm"
                    required
                  >
                    <option value="">— Select trade —</option>
                    {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="input-field text-sm resize-none"
                    rows={2}
                    placeholder="Optional description..."
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="btn-primary text-xs flex-1">
                    {saving ? 'Saving...' : editingTeam ? 'Save' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="btn-secondary text-xs flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selectedTeam ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Deleted banner */}
              {selectedTeam.isDeleted && (
                <div className="bg-red-50 border-b border-red-200 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-700">This team has been archived</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Archived on {selectedTeam.deletedAt ? new Date(selectedTeam.deletedAt).toLocaleDateString() : 'Unknown date'}
                      — it is hidden from active views but all work orders and history are preserved.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreTeam(selectedTeam.id)}
                    disabled={saving}
                    className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Restoring...' : 'Restore team'}
                  </button>
                </div>
              )}

              {/* Team Header */}
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">{selectedTeam.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{selectedTeam.trade}</p>
              </div>

              {/* Team Stats */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 border-b border-gray-100">
                <div>
                  <p className="text-2xl font-semibold text-gray-900">{memberCount}</p>
                  <p className="text-xs text-gray-600">Member{memberCount !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-blue-600">{woCount}</p>
                  <p className="text-xs text-gray-600">Work order{woCount !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Members List */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-gray-900">Members</h4>
                  {!selectedTeam.isDeleted && !showMemberForm && (
                    <button
                      onClick={() => { setShowMemberForm(true); setSelectedUserId(''); }}
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      + Add
                    </button>
                  )}
                </div>

                {!selectedTeam.isDeleted && showMemberForm && (
                  <form onSubmit={handleAddMember} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                    <select
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      className="input-field text-xs"
                      required
                    >
                      <option value="">— Select user —</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving || !selectedUserId} className="btn-primary text-xs flex-1">
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMemberForm(false)}
                        className="btn-secondary text-xs flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {selectedTeam.members.length === 0 ? (
                    <p className="text-xs text-gray-500">No members yet</p>
                  ) : (
                    selectedTeam.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                          <p className="text-xs text-gray-600">{member.user.email}</p>
                        </div>
                        {!selectedTeam.isDeleted && (
                          <button
                            onClick={() => handleRemoveMember(member.user.id)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">Select a team to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
