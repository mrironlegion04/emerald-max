'use client'

import { useState } from 'react'
import { ChevronDown, Download, Users, AlertCircle } from 'lucide-react'

interface BulkActionsProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  totalCount: number
  technicians: Array<{ id: string; name: string; role: string }>
  onAction: (action: string, payload: any) => Promise<void>
}

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function BulkActions({
  selectedIds,
  onSelectionChange,
  totalCount,
  technicians,
  onAction,
}: BulkActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectAll = () => {
    if (selectedIds.length === totalCount) {
      onSelectionChange([])
    } else {
      // This will be wired properly in parent - for now just show the checkbox state
      onSelectionChange([...selectedIds]) // Parent will handle full selection
    }
  }

  const isAllSelected = selectedIds.length === totalCount && totalCount > 0

  const handleBulkAssign = async (technicianId: string) => {
    setLoading(true)
    setError(null)
    try {
      await onAction('assign', { technicianId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkStatus = async (status: string) => {
    setLoading(true)
    setError(null)
    try {
      await onAction('status', { status })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkExport = async () => {
    setLoading(true)
    setError(null)
    try {
      await onAction('export', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export')
    } finally {
      setLoading(false)
    }
  }

  if (selectedIds.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 border-gray-300 rounded text-blue-600"
              title="Select all work orders"
            />
            <span className="text-sm font-medium text-gray-900">
              {selectedIds.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Assign Button */}
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Users className="w-4 h-4" />
                Assign to
                <ChevronDown className="w-4 h-4" />
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {technicians.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-600">No technicians available</div>
                    ) : (
                      technicians.map(tech => (
                        <button
                          key={tech.id}
                          onClick={() => {
                            handleBulkAssign(tech.id)
                            setIsOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-900 flex items-center justify-between"
                        >
                          <span>{tech.name}</span>
                          <span className="text-xs text-gray-500">{tech.role}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Button */}
            <div className="relative group">
              <button
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Change status
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="py-1">
                  {statusOptions.map(status => (
                    <button
                      key={status.value}
                      onClick={() => handleBulkStatus(status.value)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-900"
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={handleBulkExport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            {/* Close Button */}
            <button
              onClick={() => onSelectionChange([])}
              className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
