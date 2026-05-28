'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2, Edit2, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

interface AssetCategory {
  id: string
  name: string
}

interface SLAPolicy {
  id: string
  name: string
  priority: string | null
  assetCategoryId: string | null
  responseTarget: number
  resolutionTarget: number
  isActive: boolean
  createdAt: string
}

export default function SLAPoliciesPage() {
  const [policies, setPolicies] = useState<SLAPolicy[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const ITEMS_PER_PAGE = 25
  
  const [formData, setFormData] = useState({
    name: '',
    priority: null as string | null,
    assetCategoryId: null as string | null,
    responseTimeHours: 4,
    resolutionTimeHours: 24,
    isActive: true,
  })

  useEffect(() => {
    fetchPolicies(currentPage)
    fetchCategories()
  }, [currentPage])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/asset-categories')
      if (!res.ok) throw new Error('Failed to fetch categories')
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error('Failed to load categories')
    }
  }

  const fetchPolicies = async (page: number) => {
    try {
      const res = await fetch(`/api/sla-policies?page=${page}&limit=${ITEMS_PER_PAGE}`)
      if (!res.ok) throw new Error('Failed to fetch SLA policies')
      const data = await res.json()
      setPolicies(data.policies)
      setTotalCount(data.totalCount)
      setTotalPages(Math.ceil(data.totalCount / ITEMS_PER_PAGE))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate at least one of priority or assetCategoryId is selected
    if (!formData.priority && !formData.assetCategoryId) {
      setError('Select either Priority or Asset Category')
      return
    }

    try {
      const method = editingId ? 'PATCH' : 'POST'
      const url = editingId ? `/api/sla-policies/${editingId}` : '/api/sla-policies'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          priority: formData.priority,
          assetCategoryId: formData.assetCategoryId,
          responseTarget: formData.responseTimeHours * 60,
          resolutionTarget: formData.resolutionTimeHours * 60,
          isActive: formData.isActive,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save SLA policy')
      }
      
      setCurrentPage(1)
      setShowForm(false)
      setEditingId(null)
      setFormData({
        name: '',
        priority: null,
        assetCategoryId: null,
        responseTimeHours: 4,
        resolutionTimeHours: 24,
        isActive: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleEdit = (policy: SLAPolicy) => {
    setFormData({
      name: policy.name,
      priority: policy.priority ?? null,
      assetCategoryId: policy.assetCategoryId ?? null,
      responseTimeHours: Math.round(policy.responseTarget / 60),
      resolutionTimeHours: Math.round(policy.resolutionTarget / 60),
      isActive: policy.isActive,
    })
    setEditingId(policy.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SLA policy?')) return
    
    try {
      const res = await fetch(`/api/sla-policies/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete SLA policy')
      setCurrentPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="SLA Policies"
        subtitle={`Manage service level agreements · ${totalCount} total · ${policies.length} showing`}
        action={
          <button
            onClick={() => {
              setShowForm(true)
              setEditingId(null)
              setFormData({
                name: '',
                priority: 'MEDIUM',
                assetCategoryId: null,
                responseTimeHours: 4,
                resolutionTimeHours: 24,
                isActive: true,
              })
            }}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Policy
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tables and Cards Container */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium">Loading SLA policies...</div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-sm text-slate-500 font-medium">No SLA policies yet.</p>
          <p className="text-xs text-slate-400 mt-1">Create an SLA policy to define response/resolution times for maintenance events.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
          {/* Mobile/Tablet Card View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {policies.map((policy) => (
              <div key={policy.id} className="p-5 space-y-3.5 hover:bg-slate-50/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{policy.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1.5">
                      <span>Category:</span>
                      <span className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                        {categories.find(c => c.id === policy.assetCategoryId)?.name || 'All Categories'}
                      </span>
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    policy.isActive 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                      : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}>
                    {policy.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shadow-3xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{policy.priority || '—'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shadow-3xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Response</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{Math.round(policy.responseTarget / 60)} hrs</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shadow-3xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resolution</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{Math.round(policy.resolutionTarget / 60)} hrs</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1.5">
                  <button
                    onClick={() => handleEdit(policy)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-xs font-bold text-slate-600 transition-all shadow-3xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 active:scale-95 text-xs font-bold text-red-600 transition-all shadow-3xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-5 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="px-5 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Asset Category</th>
                  <th className="px-5 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Response Target</th>
                  <th className="px-5 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Resolution Target</th>
                  <th className="px-5 py-4 text-left font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-4.5 font-bold text-slate-900">{policy.name}</td>
                    <td className="px-5 py-4.5">
                      {policy.priority ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          policy.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border border-red-100' :
                          policy.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          policy.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-50 text-slate-700 border border-slate-150'
                        }`}>
                          {policy.priority}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold">Any</span>
                      )}
                    </td>
                    <td className="px-5 py-4.5 text-slate-600 font-semibold">
                      {categories.find(c => c.id === policy.assetCategoryId)?.name || (
                        <span className="text-slate-400 font-semibold text-xs">Any category</span>
                      )}
                    </td>
                    <td className="px-5 py-4.5 text-slate-700 font-semibold">{Math.round(policy.responseTarget / 60)} hours</td>
                    <td className="px-5 py-4.5 text-slate-700 font-semibold">{Math.round(policy.resolutionTarget / 60)} hours</td>
                    <td className="px-5 py-4.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${policy.isActive ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-650'}`}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(policy)}
                          className="text-slate-500 hover:text-blue-600 p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(policy.id)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/20">
              <div className="text-xs text-slate-500 font-medium">
                Page <span className="font-bold text-slate-800">{currentPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
              </div>
              <div className="flex gap-1.5">
                {currentPage > 1 && (
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    ← First
                  </button>
                )}
                {currentPage > 1 && (
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    ← Previous
                  </button>
                )}
                {currentPage < totalPages && (
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Next →
                  </button>
                )}
                {currentPage < totalPages && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Last →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.40)' }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100/80">
            <h2 className="text-lg font-bold text-slate-900 mb-4 select-none">
              {editingId ? 'Edit SLA Policy' : 'New SLA Policy'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Policy Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input-field"
                  placeholder="e.g. Critical Mechanical SLA"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={formData.priority || ''}
                    onChange={(e) => setFormData({...formData, priority: e.target.value || null})}
                    className="input-field pointer-events-auto cursor-pointer"
                  >
                    <option value="">Any</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Asset Category
                  </label>
                  <select
                    value={formData.assetCategoryId || ''}
                    onChange={(e) => setFormData({...formData, assetCategoryId: e.target.value || null})}
                    className="input-field pointer-events-auto cursor-pointer"
                  >
                    <option value="">Any category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium select-none -mt-1">Define either specific priority or asset category (or both) to map this policy.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Response Target (hrs)
                  </label>
                  <input
                    type="number"
                    value={formData.responseTimeHours}
                    onChange={(e) => setFormData({...formData, responseTimeHours: parseInt(e.target.value) || 0})}
                    className="input-field"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Resolution Target (hrs)
                  </label>
                  <input
                    type="number"
                    value={formData.resolutionTimeHours}
                    onChange={(e) => setFormData({...formData, resolutionTimeHours: parseInt(e.target.value) || 0})}
                    className="input-field"
                    required
                    min="1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4.5 h-4.5 border border-slate-200 rounded-lg text-blue-600 cursor-pointer focus:ring-0"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-700 select-none cursor-pointer">
                  Activate this SLA Policy
                </label>
              </div>
              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary !text-xs py-2 px-4 flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary !text-xs py-2 px-4 flex-1"
                >
                  {editingId ? 'Update Policy' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
