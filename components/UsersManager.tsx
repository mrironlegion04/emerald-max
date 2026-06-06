'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Badge from '@/components/Badge'
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  FolderLock,
  Lock,
  Shield,
  CircleDot
} from 'lucide-react'

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
  domainId?: string | null
  domain?: { id: string; name: string } | null
  lastActiveAt?: string | null
  _count: {
    assignedWorkOrders: number
    createdWorkOrders: number
    skills: number
  }
}

interface Domain {
  id: string
  name: string
}

export default function UsersManager() {
  const router = useRouter()
  
  // Data State
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const refreshData = () => {
    setLoading(true)
    setError('')
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/domains').then(r => r.json())
    ])
      .then(([meData, usersData, domainsData]) => {
        if (meData?.user) {
          setCurrentUser({
            id: meData.user.userId,
            name: meData.user.name,
            email: meData.user.email,
            role: meData.user.role,
          })
        }
        if (Array.isArray(usersData)) {
          setAllUsers(usersData)
        } else {
          setAllUsers([])
        }
        if (Array.isArray(domainsData)) {
          setDomains(domainsData)
        } else {
          setDomains([])
        }
      })
      .catch(err => {
        console.error(err)
        setError('Failed to load users directory. Please refresh the page.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refreshData()
  }, [])

  const filteredUsers = allUsers.filter(u => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))

    const matchesRole = roleFilter === '' || u.role === roleFilter
    const matchesDomain = domainFilter === '' || u.domainId === domainFilter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'inactive' && !u.isActive)

    return matchesSearch && matchesRole && matchesDomain && matchesStatus
  })

  const isUserAdmin = currentUser?.role === 'ADMIN'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 mt-3">Loading users directory...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 select-none">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-3xs">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Directory Users</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{allUsers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-3xs">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Staff</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{allUsers.filter(u => u.isActive).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-3xs">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Engineering Managers</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">{allUsers.filter(u => u.role === 'MANAGER').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-3xs">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Technicians</p>
          <p className="text-2xl font-extrabold text-purple-600 mt-1">{allUsers.filter(u => u.role === 'TECHNICIAN').length}</p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search directory by name, email, department..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field pl-9 py-2 text-sm text-slate-800"
            />
          </div>
          <div className="flex flex-wrap gap-2 md:w-auto">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="input-field max-w-xs cursor-pointer text-xs"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="TECHNICIAN">TECHNICIAN</option>
            </select>

            <select
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              className="input-field max-w-xs cursor-pointer text-xs"
            >
              <option value="">All Domains</option>
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input-field max-w-xs cursor-pointer text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {isUserAdmin && (
              <Link href="/users/new" className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 px-4 rounded-lg font-bold text-xs shadow-xs transition duration-150">
                <Plus className="w-3.5 h-3.5" />
                Add User
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-extrabold text-xs uppercase tracking-wider text-left select-none">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Maintenance Domain</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">WorkOrders</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                    No registry users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const nameInitials = u.name
                    ? u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'U'
                  const roleColors: Record<string, 'purple' | 'blue' | 'green'> = {
                    ADMIN: 'purple',
                    MANAGER: 'blue',
                    TECHNICIAN: 'green',
                  }

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name Card */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-3xs">
                            <span className="text-blue-700 font-extrabold text-xs">{nameInitials}</span>
                          </div>
                          <div className="min-w-0">
                            <Link href={`/users/${u.id}`} className="font-extrabold text-slate-900 text-sm hover:text-blue-600 truncate block leading-snug">
                              {u.name}
                            </Link>
                            <span className="font-mono text-xs text-slate-400 truncate block mt-0.5">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-5 py-3.5">
                        <Badge label={u.role} variant={roleColors[u.role] || 'gray'} />
                      </td>

                      {/* Maintenance Domain */}
                      <td className="px-5 py-3.5">
                        {u.domain ? (
                          <span className="text-slate-800 text-xs font-bold leading-none bg-indigo-50 border border-indigo-150 py-1 px-2 rounded-md inline-flex items-center gap-1.5 select-none">
                            <CircleDot className="w-2.5 h-2.5 text-indigo-500" />
                            {u.domain.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3.5 text-slate-700 text-xs">
                        {u.department || '—'}
                      </td>

                      {/* WorkOrders Workload count */}
                      <td className="px-5 py-3.5 text-slate-700 text-xs font-mono">
                        {u._count.assignedWorkOrders} active
                      </td>

                      {/* Directory Status check */}
                      <td className="px-5 py-3.5">
                        <Badge
                          label={u.isActive ? 'Active' : 'Deactivated'}
                          variant={u.isActive ? 'green' : 'gray'}
                        />
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-3.5 text-right flex items-center justify-end gap-3.5 select-none">
                        <Link href={`/users/${u.id}`} className="text-xs text-slate-500 hover:text-slate-900 font-bold">
                          View
                        </Link>
                        {isUserAdmin && (
                          <Link href={`/users/${u.id}/edit`} className="text-xs text-blue-600 hover:text-blue-900 font-bold">
                            Edit
                          </Link>
                        )}
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
  )
}
