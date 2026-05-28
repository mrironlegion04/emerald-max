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

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : policies.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No SLA policies yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Priority</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Asset Category</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Response Time</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Resolution Time</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900">{policy.name}</td>
                  <td className="px-6 py-4 text-gray-600">{policy.priority || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {categories.find(c => c.id === policy.assetCategoryId)?.name || '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{Math.round(policy.responseTarget / 60)}h</td>
                  <td className="px-6 py-4 text-gray-600">{Math.round(policy.resolutionTarget / 60)}h</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${policy.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {policy.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(policy)}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50"
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-5 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="btn-secondary text-sm"
                  >
                    ← First
                  </button>
                )}
                {currentPage > 1 && (
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="btn-secondary text-sm"
                  >
                    ← Previous
                  </button>
                )}
                {currentPage < totalPages && (
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="btn-secondary text-sm"
                  >
                    Next →
                  </button>
                )}
                {currentPage < totalPages && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="btn-secondary text-sm"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit SLA Policy' : 'New SLA Policy'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority (Optional)
                </label>
                <select
                  value={formData.priority || ''}
                  onChange={(e) => setFormData({...formData, priority: e.target.value || null})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">-- None --</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Category (Optional)
                </label>
                <select
                  value={formData.assetCategoryId || ''}
                  onChange={(e) => setFormData({...formData, assetCategoryId: e.target.value || null})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">-- None --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Select at least Priority or Category</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Response Time (hours)
                </label>
                <input
                  type="number"
                  value={formData.responseTimeHours}
                  onChange={(e) => setFormData({...formData, responseTimeHours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Time (hours)
                </label>
                <input
                  type="number"
                  value={formData.resolutionTimeHours}
                  onChange={(e) => setFormData({...formData, resolutionTimeHours: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 border border-gray-300 rounded text-blue-600"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
