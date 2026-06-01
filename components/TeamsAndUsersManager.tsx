'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import {
  Users,
  Search,
  Plus,
  AlertCircle,
  Archive,
  RefreshCw,
  X,
  UserCheck,
  Award,
  Lock,
  ClipboardList
} from 'lucide-react'

// Interfaces matching Prisma schema
interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN'
  isActive: boolean
  createdAt: string
  phone?: string | null
  bio?: string | null
  department?: string | null
  lastActiveAt?: string | null
  _count: {
    assignedWorkOrders: number
    createdWorkOrders: number
    skills: number
  }
}

interface TeamMemberData {
  id: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface Team {
  id: string
  name: string
  trade: string
  description: string | null
  members: TeamMemberData[]
  workOrders?: unknown[]
  isDeleted?: boolean
  deletedAt?: string | null
  deletedBy?: string | null
}

const TRADES = [
  'Electrical', 'HVAC', 'Plumbing', 'Mechanical', 'Carpentry',
  'Painting', 'Welding', 'HVAC Refrigeration', 'General Maintenance',
  'Facilities', 'Safety', 'Quality Assurance', 'Automation'
]

export default function TeamsAndUsersManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab')

  // Core State
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>(tabParam === 'users' ? 'users' : 'teams')
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null)
  
  // Data State
  const [teams, setTeams] = useState<Team[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Team Specific UI State
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showNewTeamForm, setShowNewTeamForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [showTeamDeleted, setShowTeamDeleted] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '', trade: '', description: '' })
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [selectedUserIdForMember, setSelectedUserIdForMember] = useState('')

  // Teams query/filter state
  const [teamSearch, setTeamSearch] = useState('')
  const [teamTradeFilter, setTeamTradeFilter] = useState('')

  // Users query/filter state
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userDeptFilter, setUserDeptFilter] = useState('')

  // Sync tab state with URL parameter
  useEffect(() => {
    if (tabParam === 'users') {
      setActiveTab('users')
    } else {
      setActiveTab('teams')
    }
  }, [tabParam])

  // Fetch Session data, teams, and users
  const refreshData = useCallback(() => {
    setLoading(true)
    const teamsUrl = showTeamDeleted ? '/api/teams?showDeleted=true' : '/api/teams'
    
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch(teamsUrl).then(r => r.json()),
      fetch('/api/users').then(r => r.json())
    ])
      .then(([sessionData, teamsData, usersData]: [{ user: { userId: string; name: string; email: string; role: string } | null }, Team[], User[]]) => {
        if (sessionData?.user) {
          setCurrentUser({
            id: sessionData.user.userId,
            name: sessionData.user.name,
            email: sessionData.user.email,
            role: sessionData.user.role,
          })
        }
        setTeams(teamsData)
        setAllUsers(usersData)

        // Sync currently selected team when list refreshes
        if (selectedTeam) {
          const currentVersion = teamsData.find((t: Team) => t.id === selectedTeam.id)
          if (currentVersion) {
            setSelectedTeam(currentVersion)
          }
        }
      })
      .catch((err) => {
        console.error(err)
        setError('Failed to securely connect to directories. Please retry.')
      })
      .finally(() => setLoading(false))
  }, [showTeamDeleted, selectedTeam])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  const setTab = (tab: 'teams' | 'users') => {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    router.push(`/teams?${params.toString()}`)
  }

  // --- Team Event Handlers ---
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamForm.name || !teamForm.trade) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const newTeam = await res.json()
      setTeams([...teams, newTeam])
      setSelectedTeam(newTeam)
      setTeamForm({ name: '', trade: '', description: '' })
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
    if (!editingTeam || !teamForm.name || !teamForm.trade) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const updated = await res.json()
      setTeams(teams.map(t => t.id === updated.id ? updated : t))
      setSelectedTeam(updated)
      setEditingTeam(null)
      setTeamForm({ name: '', trade: '', description: '' })
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveTeam(teamId: string) {
    if (!confirm('Archive this team? Operational assignments will be preserved.')) return
    
    setSaving(true)
    setError('')
    try {
      let res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })

      if (res.status === 409) {
        const data = await res.json()
        if (data.requiresForce) {
          const msg = `This team has ${data.activeWorkOrders} active work order${data.activeWorkOrders !== 1 ? 's' : ''} assigned.\n\nAre you sure you want to archive it elements anyway?`
          if (!confirm(msg)) return

          res = await fetch(`/api/teams/${teamId}?force=true`, { method: 'DELETE' })
        }
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Archive failed')
      }
      
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
    if (!selectedTeam || !selectedUserIdForMember) return
    
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-member', userId: selectedUserIdForMember }),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const updated = await res.json()
      setTeams(teams.map(t => t.id === updated.id ? updated : t))
      setSelectedTeam(updated)
      setSelectedUserIdForMember('')
      setShowMemberForm(false)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeam || !confirm('Remove this operator from the team?')) return
    
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

  function startEditTeam(team: Team) {
    setEditingTeam(team)
    setTeamForm({ name: team.name, trade: team.trade, description: team.description || '' })
    setShowNewTeamForm(false)
  }

  // --- Dynamic Filtering Lists ---
  const filteredTeams = teams.filter(team => {
    const matchesSearch = !teamSearch || 
      team.name.toLowerCase().includes(teamSearch.toLowerCase()) || 
      (team.description && team.description.toLowerCase().includes(teamSearch.toLowerCase()))
    
    const matchesTrade = !teamTradeFilter || team.trade === teamTradeFilter
    return matchesSearch && matchesTrade
  })

  const filteredUsers = allUsers.filter(u => {
    const query = userSearch.toLowerCase()
    const matchesSearch = !userSearch ||
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.department && u.department.toLowerCase().includes(query)) ||
      (u.phone && u.phone.toLowerCase().includes(query))

    const matchesRole = !userRoleFilter || u.role === userRoleFilter
    const matchesStatus = userStatusFilter === 'all' ? true :
                          userStatusFilter === 'active' ? u.isActive : !u.isActive
    const matchesDept = !userDeptFilter || u.department === userDeptFilter

    return matchesSearch && matchesRole && matchesStatus && matchesDept
  })

  // Unique departments for custom quick selector
  const departments = Array.from(new Set(allUsers.map(u => u.department).filter(Boolean))) as string[]

  const isUserAdmin = currentUser?.role === 'ADMIN'

  // Loading indicator for background fetches
  if (loading && teams.length === 0 && allUsers.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Connecting directories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Dynamic Header */}
      <PageHeader
        title="Teams / Users"
        subtitle={`${teams.length} active teams · ${allUsers.length} registered system users`}
        action={
          <div className="flex gap-2.5 ml-auto w-full sm:w-auto">
            {activeTab === 'teams' ? (
              <button
                onClick={() => {
                  setShowNewTeamForm(true)
                  setEditingTeam(null)
                  setTeamForm({ name: '', trade: '', description: '' })
                }}
                className="btn-primary text-sm flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" /> Team
              </button>
            ) : (
              isUserAdmin && (
                <Link
                  href="/users/new"
                  className="btn-primary text-sm flex items-center gap-1.5 w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4" /> User
                </Link>
              )
            )}
            <Link href="/settings/skills" className="btn-secondary text-sm flex items-center gap-1.5 w-full sm:w-auto justify-center">
              <Award className="w-4 h-4 text-slate-400" /> Skills Catalog
            </Link>
          </div>
        }
      />

      {error && (
        <div className="bg-rose-50 border border-rose-250 text-rose-800 px-4 py-3 rounded-xl text-sm mb-6 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Error encountered:</span> {error}
          </div>
          <button onClick={() => setError('')} className="p-0.5 hover:bg-rose-100 rounded text-rose-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs segment control */}
      <div className="border-b border-slate-200 mb-6 flex items-center gap-1.5">
        <button
          onClick={() => setTab('teams')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'teams'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Users className="w-4.5 h-4.5" />
          <span>Operational Teams ({teams.filter(t => !t.isDeleted).length})</span>
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <UserCheck className="w-4.5 h-4.5" />
          <span>Users Directory ({allUsers.length})</span>
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'teams' ? (
        <div className="space-y-4">
          {/* Teams Filter bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-200 mb-3">
            <div className="relative flex-1">
              <Search className="w-4.5 h-4.5 text-slate-405 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search teams by name, specialization, keywords..."
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                className="input-field pl-9.5 py-1.5 text-sm"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={teamTradeFilter}
                onChange={e => setTeamTradeFilter(e.target.value)}
                className="input-field text-sm cursor-pointer py-1.5 h-full"
              >
                <option value="">All Trades / Specs</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600 pr-2 cursor-pointer select-none font-bold">
                <input
                  type="checkbox"
                  checked={showTeamDeleted}
                  onChange={e => {
                    setShowTeamDeleted(e.target.checked)
                    setSelectedTeam(null)
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-red-650 focus:ring-red-500 cursor-pointer"
                />
                Show Archived
              </label>
            </div>
          </div>

          {/* Teams Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Teams Column list (Takes 2 columns) */}
            <div className={`lg:col-span-2 ${selectedTeam && !showNewTeamForm && !editingTeam ? 'hidden lg:block' : 'block'}`}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                {filteredTeams.length === 0 ? (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-600">No operational teams found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Try refining your searches or trigger &quot;+ Team&quot; to register a new trade group.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredTeams.map(team => {
                      const isSelected = selectedTeam?.id === team.id
                      return (
                        <div
                          key={team.id}
                          onClick={() => setSelectedTeam(team)}
                          className={`p-4.5 cursor-pointer transition-all flex items-start justify-between gap-4 select-none ${
                            isSelected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : 'hover:bg-slate-50/40'
                          } ${team.isDeleted ? 'bg-rose-50/25 opacity-70' : ''}`}
                        >
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 text-sm truncate leading-snug">{team.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 font-semibold">{team.trade}</span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[11px] font-bold text-slate-400">{team.members.length} members</span>
                            </div>
                            {team.description && (
                              <p className="text-xs text-slate-400 mt-1.5 truncate max-w-xl font-medium">{team.description}</p>
                            )}

                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {team.isDeleted && <Badge label="Archived" variant="red" />}
                              <span className="text-[10px] font-bold bg-slate-100 border border-slate-205 text-slate-600 px-2 py-0.5 rounded-md">
                                {team.members.length} Active Operators
                              </span>
                              {team.workOrders && team.workOrders.length > 0 && (
                                <span className="text-[10px] font-bold bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <ClipboardList className="w-3 h-3" /> {team.workOrders.length} assigned work orders
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {!team.isDeleted ? (
                              <>
                                <button
                                  onClick={() => startEditTeam(team)}
                                  className="text-slate-600 hover:text-blue-700 font-bold text-xs bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-3xs transition-all active:scale-95 cursor-pointer"
                                >
                                  Configure
                                </button>
                                <button
                                  onClick={() => handleArchiveTeam(team.id)}
                                  className="text-slate-500 hover:text-rose-700 font-bold text-xs bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-100 px-2.5 py-1.5 rounded-lg shadow-3xs transition-all active:scale-95 cursor-pointer"
                                  title="Archive Team"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleRestoreTeam(team.id)}
                                className="text-emerald-700 hover:text-emerald-900 font-bold text-xs bg-emerald-50 border border-emerald-150 px-2.5 py-1.5 rounded-lg shadow-3xs hover:shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.0 h-3.0 animate-spin-slow" /> Restore
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Panel View / Operation Forms (Takes 1 column) */}
            <div className={`lg:col-span-1 ${selectedTeam || showNewTeamForm || editingTeam ? 'block' : 'hidden lg:block'}`}>
              
              {showNewTeamForm || editingTeam ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm">
                      {editingTeam ? 'Update Team Details' : 'Configure New Team'}
                    </h3>
                    <button
                      onClick={() => { setShowNewTeamForm(false); setEditingTeam(null); }}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">Team name *</label>
                      <input
                        type="text"
                        value={teamForm.name}
                        onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                        className="input-field text-sm"
                        placeholder="e.g. Mechanical Reliability"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">Trade / Specialty *</label>
                      <select
                        value={teamForm.trade}
                        onChange={e => setTeamForm({ ...teamForm, trade: e.target.value })}
                        className="input-field text-sm cursor-pointer"
                        required
                      >
                        <option value="">— Select trade specialization —</option>
                        {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                      <textarea
                        value={teamForm.description}
                        onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                        className="input-field text-sm resize-none"
                        rows={3}
                        placeholder="Purpose constraints, dispatch codes, general area coverage..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary text-xs flex-1 py-2 font-bold"
                      >
                        {saving ? 'Saving...' : editingTeam ? 'Update Layout' : 'Create Team'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewTeamForm(false); setEditingTeam(null); }}
                        className="btn-secondary text-xs flex-1 py-2 font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : selectedTeam ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Mobile Back navigation button */}
                  <div className="p-3 border-b border-slate-100 lg:hidden bg-slate-50 flex items-center">
                    <button
                      onClick={() => setSelectedTeam(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white shadow-3xs px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                    >
                      ← Back to index
                    </button>
                  </div>

                  {/* Team Archive Banner */}
                  {selectedTeam.isDeleted && (
                    <div className="bg-amber-50/50 border-b border-amber-200 p-4.5 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Archived Trade Unit</p>
                        <p className="text-xs text-amber-700 font-semibold leading-relaxed mt-1">
                          Since archiving, dispatcher search filters ignore this team. Live personnel links remain valid for logs.
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreTeam(selectedTeam.id)}
                        disabled={saving}
                        className="btn-success !text-[11px] py-1.5 px-3.5 shadow-3xs"
                      >
                        {saving ? 'Restoring...' : 'Restore Operational Status'}
                      </button>
                    </div>
                  )}

                  {/* Top Details Header */}
                  <div className="p-5 border-b border-slate-100">
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 tracking-wider inline-block">
                      {selectedTeam.trade}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-2">{selectedTeam.name}</h3>
                    {selectedTeam.description && (
                      <p className="text-xs text-slate-450 font-medium leading-relaxed mt-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-105">
                        {selectedTeam.description}
                      </p>
                    )}
                  </div>

                  {/* Quick Personnel Assignment */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Personnel ({selectedTeam.members.length})</h4>
                      {!selectedTeam.isDeleted && !showMemberForm && (
                        <button
                          onClick={() => { setShowMemberForm(true); setSelectedUserIdForMember(''); }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                        >
                          + Link Operator
                        </button>
                      )}
                    </div>

                    {!selectedTeam.isDeleted && showMemberForm && (
                      <form onSubmit={handleAddMember} className="space-y-2 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                        <select
                          value={selectedUserIdForMember}
                          onChange={e => setSelectedUserIdForMember(e.target.value)}
                          className="input-field text-xs cursor-pointer"
                          required
                        >
                          <option value="">— Choose matching operator —</option>
                          {allUsers
                            .filter(u => u.isActive && !selectedTeam.members.some(m => m.user.id === u.id))
                            .map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role}) — {u.department || 'No dept'}
                              </option>
                            ))
                          }
                        </select>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={saving || !selectedUserIdForMember}
                            className="btn-primary !text-[11px] py-1.5 flex-1 font-bold"
                          >
                            Link
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowMemberForm(false)}
                            className="btn-secondary !text-[11px] py-1.5 flex-1 font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {selectedTeam.members.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          No personnel assigned yet
                        </div>
                      ) : (
                        selectedTeam.members.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-bold text-slate-900 truncate">{member.user.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{member.user.email}</p>
                            </div>
                            {!selectedTeam.isDeleted && (
                              <button
                                onClick={() => handleRemoveMember(member.user.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer flex-shrink-0"
                                title="Unlink member"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed p-12 text-center select-none">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-extrabold text-slate-600">No team selected</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Select a trade team from the operational schedule index to coordinate links and specializations.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* USERS INDEX TAB VIEW */
        <div className="space-y-6">
          {/* Statistics summary top cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 select-none">
            <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-3xs hover:border-slate-300 transition-colors">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Users</p>
              <p className="text-2.5xl font-extrabold text-slate-900 mt-1">{allUsers.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-3xs hover:border-slate-300 transition-colors">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Admins</p>
              <p className="text-2.5xl font-extrabold text-purple-600 mt-1">{allUsers.filter(u => u.role === 'ADMIN').length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-3xs hover:border-slate-300 transition-colors">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Status</p>
              <p className="text-2.5xl font-extrabold text-emerald-600 mt-1">{allUsers.filter(u => u.isActive).length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-3xs hover:border-slate-300 transition-colors">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Technicians</p>
              <p className="text-2.5xl font-extrabold text-blue-600 mt-1">{allUsers.filter(u => u.role === 'TECHNICIAN').length}</p>
            </div>
          </div>

          {/* Users Filtering control */}
          <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex flex-col md:flex-row gap-3 items-stretch">
              
              {/* Query Search */}
              <div className="relative flex-1">
                <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search directory by name, email, phone coordinates..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="input-field pl-10 h-full py-2.5 text-sm"
                />
              </div>

              {/* Selectors filters */}
              <div className="grid grid-cols-3 gap-2.5 sm:w-auto md:w-1/2">
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="input-field cursor-pointer text-xs"
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="TECHNICIAN">TECHNICIAN</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={e => setUserStatusFilter(e.target.value)}
                  className="input-field cursor-pointer text-xs"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>

                <select
                  value={userDeptFilter}
                  onChange={e => setUserDeptFilter(e.target.value)}
                  className="input-field cursor-pointer text-xs"
                >
                  <option value="">All Depts</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Users Output Component list */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Mobile View layouts card container */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">No profiles match active selection query filter.</div>
              ) : (
                filteredUsers.map(u => {
                  const initials = u.name ? u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'
                  const roleBadgeColor = u.role === 'ADMIN' ? 'purple' : u.role === 'MANAGER' ? 'blue' : 'green'
                  
                  return (
                    <div key={u.id} className="p-4.5 space-y-3 hover:bg-slate-50/20 active:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-3xs">
                          <span className="text-blue-700 font-extrabold text-xs">{initials}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/users/${u.id}/view`} className="font-extrabold text-slate-900 text-sm hover:text-blue-600 block leading-tight truncate">
                            {u.name}
                          </Link>
                          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{u.email}</p>
                          {u.phone && <p className="text-[10px] text-slate-405 font-mono mt-0.5">{u.phone}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <Badge label={u.role} variant={roleBadgeColor} />
                          <Badge label={u.isActive ? 'Active' : 'Inactive'} variant={u.isActive ? 'green' : 'gray'} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs py-1.5 border-t border-b border-dashed border-slate-100 font-medium text-slate-650">
                        <div>
                          <span className="text-slate-400 font-extrabold block uppercase tracking-wider text-[8px] mb-0.5">Department</span>
                          <span className="text-slate-800 font-bold">{u.department || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-extrabold block uppercase tracking-wider text-[8px] mb-0.5">Skills</span>
                          <span className="text-slate-800 font-bold">{u._count.skills} cataloged</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs text-slate-405 font-bold">
                          Workload: <span className="font-extrabold text-slate-700">{u._count.assignedWorkOrders} assigned</span>
                        </div>
                        <div className="flex gap-3">
                          <Link href={`/users/${u.id}/view`} className="text-xs text-slate-500 hover:text-slate-800 font-bold">
                            Review Profile
                          </Link>
                          {isUserAdmin && (
                            <Link href={`/users/${u.id}/edit`} className="text-xs text-blue-600 hover:text-blue-800 font-bold">
                              Edit Details
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50">
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">User Profile</th>
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">Authorization Role</th>
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">Directory Status</th>
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">Location/Department</th>
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">Certified Skills</th>
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">Active WorkOrders</th>
                    <th className="text-left px-5 py-3.5 font-extrabold text-slate-450 text-xs uppercase tracking-wider">Joined Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-slate-405 font-medium">
                        No team member records match active dashboard query filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const initials = u.name ? u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'
                      const roleBadgeColor = u.role === 'ADMIN' ? 'purple' : u.role === 'MANAGER' ? 'blue' : 'green'
                      const joinedDate = new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-3xs">
                                <span className="text-blue-700 font-extrabold text-xs">{initials}</span>
                              </div>
                              <div className="min-w-0">
                                <Link href={`/users/${u.id}/view`} className="font-extrabold text-slate-900 hover:text-blue-600 block truncate leading-tight">
                                  {u.name}
                                </Link>
                                <p className="text-xs text-slate-405 font-medium truncate mt-0.5">{u.email}</p>
                                {u.phone && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge label={u.role} variant={roleBadgeColor} />
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge label={u.isActive ? 'Active' : 'Inactive'} variant={u.isActive ? 'green' : 'gray'} />
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {u.department ? (
                              <span className="text-xs decoration-slate-400">{u.department}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {u._count.skills > 0 ? (
                              <Badge label={`${u._count.skills} certified`} variant="blue" />
                            ) : (
                              <span className="text-xs text-slate-300">Uncataloged</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-bold">
                            <span className="bg-slate-50 border border-slate-100 text-slate-700 px-2.5 py-1 rounded font-mono text-xs">
                              {u._count.assignedWorkOrders} assigned / {u._count.createdWorkOrders} created
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-bold text-slate-400">{joinedDate}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center gap-2.5 justify-end">
                              <Link href={`/users/${u.id}/view`} className="text-xs text-slate-500 hover:text-slate-900 font-bold">
                                View
                              </Link>
                              {isUserAdmin ? (
                                <Link href={`/users/${u.id}/edit`} className="text-xs text-blue-600 hover:text-blue-800 font-bold">
                                  Edit
                                </Link>
                              ) : (
                                <span className="text-slate-200 cursor-not-allowed" title="Requires Administrator privileges">
                                  <Lock className="w-3.5 h-3.5 inline" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
