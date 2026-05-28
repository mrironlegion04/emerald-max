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
        <div className={`lg:col-span-2 ${selectedTeam && !showNewTeamForm && !editingTeam ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
            {teams.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">
                <p>No teams configured yet. Create your first operational team to start mapping assignments.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {teams.map(team => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={`p-4.5 cursor-pointer transition-colors ${
                      selectedTeam?.id === team.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : 'hover:bg-slate-50/30'
                    } ${team.isDeleted ? 'opacity-50 bg-red-50/40' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-sm truncate leading-snug">{team.name}</h3>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">{team.trade}</p>
                        {team.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate max-w-xl">{team.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {team.isDeleted && (
                            <Badge label="Deleted" variant="red" />
                          )}
                          <span className="text-[11px] font-bold bg-slate-100 text-slate-650 px-2 py-0.5 rounded-md">
                            {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                            {team.workOrders?.length || 0} WO{team.workOrders?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {selectedTeam?.id === team.id && (
                        <div className="flex gap-2.5 ml-4 flex-shrink-0">
                          {!team.isDeleted && (
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(team); }}
                              className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 border border-blue-150 px-2.5 py-1 rounded-lg shadow-3xs hover:shadow-2xs transition-all active:scale-95"
                            >
                              Edit
                            </button>
                          )}
                          {!team.isDeleted ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArchiveTeam(team.id); }}
                              className="text-red-650 hover:text-red-800 font-bold text-xs bg-red-50 border border-red-150 px-2.5 py-1 rounded-lg shadow-3xs hover:shadow-2xs transition-all active:scale-95"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRestoreTeam(team.id); }}
                              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-lg shadow-3xs hover:shadow-2xs transition-all active:scale-95"
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
        <div className={`lg:col-span-1 ${selectedTeam || showNewTeamForm || editingTeam ? 'block' : 'hidden lg:block'}`}>
          {showNewTeamForm || editingTeam ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] p-5 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingTeam ? 'Edit team configuration' : 'Configure new team'}
              </h3>
              <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Team name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Electrical Team"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Trade / Specialization *</label>
                  <select
                    value={formData.trade}
                    onChange={e => setFormData({ ...formData, trade: e.target.value })}
                    className="input-field cursor-pointer pointer-events-auto"
                    required
                  >
                    <option value="">— Select trade —</option>
                    {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
              {/* Back to list button for mobile viewports */}
              <div className="p-3 border-b border-slate-100 lg:hidden bg-slate-50/50 flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-650 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-3xs active:scale-95 transition-all cursor-pointer"
                >
                  ← Back to all teams
                </button>
              </div>

              {/* Deleted banner */}
              {selectedTeam.isDeleted && (
                <div className="bg-rose-50 border-b border-rose-150 p-4.5 space-y-3.5">
                  <div>
                    <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Archived Team</p>
                    <p className="text-xs text-rose-700 font-medium leading-relaxed mt-1">
                      Archived on {selectedTeam.deletedAt ? new Date(selectedTeam.deletedAt).toLocaleDateString() : 'Unknown date'}
                      . Historic records and assignments are kept, but the team will not show in active dispatcher selections.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreTeam(selectedTeam.id)}
                    disabled={saving}
                    className="btn-success !text-xs py-1.5 px-3.5"
                  >
                    {saving ? 'Restoring...' : 'Restore Team'}
                  </button>
                </div>
              )}

              {/* Team Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{selectedTeam.name}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1">{selectedTeam.trade}</p>
                </div>
                {!selectedTeam.isDeleted && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(selectedTeam)}
                      disabled={saving}
                      className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 border border-blue-150 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all shadow-3xs cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleArchiveTeam(selectedTeam.id)}
                      disabled={saving}
                      className="text-red-650 hover:text-red-800 font-bold text-xs bg-red-50 border border-red-150 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all shadow-3xs cursor-pointer"
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>

              {/* Team Stats */}
              <div className="grid grid-cols-2 gap-3.5 p-4.5 bg-slate-50/50 border-b border-slate-100">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-3xs">
                  <p className="text-xl font-bold text-slate-900 leading-none">{memberCount}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Member{memberCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-3xs">
                  <p className="text-xl font-bold text-blue-600 leading-none">{woCount}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Work order{woCount !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Members List */}
              <div className="p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Members</h4>
                  {!selectedTeam.isDeleted && !showMemberForm && (
                    <button
                      onClick={() => { setShowMemberForm(true); setSelectedUserId(''); }}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-100/10 hover:text-blue-800 text-blue-600 font-bold active:scale-95 transition-all"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {!selectedTeam.isDeleted && showMemberForm && (
                  <form onSubmit={handleAddMember} className="space-y-2 p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                    <select
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      className="input-field text-xs cursor-pointer pointer-events-auto"
                      required
                    >
                      <option value="">— Select operator —</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving || !selectedUserId} className="btn-primary !text-xs py-1.5 flex-1 shadow-3xs">
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMemberForm(false)}
                        className="btn-secondary !text-xs py-1.5 flex-1 shadow-3xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selectedTeam.members.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium py-2">This team has no active members.</p>
                  ) : (
                    selectedTeam.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-900 truncate">{member.user.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{member.user.email}</p>
                        </div>
                        {!selectedTeam.isDeleted && (
                          <button
                            onClick={() => handleRemoveMember(member.user.id)}
                            className="text-slate-400 hover:text-red-650 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 active:scale-95 transition-all flex-shrink-0 cursor-pointer text-xs"
                            title="Remove Member"
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
            <div className="bg-slate-50/50 rounded-2xl border border-slate-250 border-dashed p-10 text-center select-none">
              <p className="text-sm font-semibold text-slate-500">No team selected</p>
              <p className="text-xs text-slate-400 mt-1">Select a team from the list to view active members, trade focus, and assigned work orders.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
