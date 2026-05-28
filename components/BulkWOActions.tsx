'use client'

import { useState } from 'react'
import { ChevronDown, Download, Users, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

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
  const [statusOpen, setStatusOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectAll = () => {
    if (selectedIds.length === totalCount) {
      onSelectionChange([])
    } else {
      onSelectionChange([...selectedIds])
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

  return (
    <AnimatePresence>
      {selectedIds.length > 0 && (
        <motion.div 
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_32px_rgba(15,23,42,0.06)] z-40 select-none pb-safe"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            {error && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 border-slate-300 rounded text-blue-600 cursor-pointer focus:ring-blue-500"
                    title="Select all rows"
                  />
                  <span className="text-sm font-bold text-slate-800">
                    {selectedIds.length} select{selectedIds.length === 1 ? 'ed row' : 'ed rows'}
                  </span>
                </div>

                <button 
                  onClick={() => onSelectionChange([])}
                  className="sm:hidden text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 transition-colors px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Selection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto select-none">
                {/* Assign Dropdown Trigger Button */}
                <div className="relative flex-1 sm:flex-none">
                  <button
                    onClick={() => {
                      setIsOpen(!isOpen)
                      setStatusOpen(false)
                    }}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-blue-500 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-3xs active:scale-[0.98]"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Assign Selected
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          transition={{ duration: 0.1 }}
                          className="absolute bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 right-0 w-52 bg-white border border-slate-205 rounded-xl shadow-lg z-50 overflow-hidden"
                        >
                          <div className="py-1 max-h-56 overflow-y-auto scrollbar-thin">
                            {technicians.length === 0 ? (
                              <div className="px-4 py-2.5 text-xs font-semibold text-slate-400 italic">No technicians available</div>
                            ) : (
                              technicians.map(tech => (
                                <button
                                  key={tech.id}
                                  onClick={() => {
                                    handleBulkAssign(tech.id)
                                    setIsOpen(false)
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                                >
                                  <span>{tech.name}</span>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-semibold">{tech.role}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Status Dropdown Trigger Button */}
                <div className="relative flex-1 sm:flex-none">
                  <button
                    onClick={() => {
                      setStatusOpen(!statusOpen)
                      setIsOpen(false)
                    }}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-purple-500 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-3xs active:scale-[0.98]"
                  >
                    Change Status
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  <AnimatePresence>
                    {statusOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          transition={{ duration: 0.1 }}
                          className="absolute bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 right-0 w-40 bg-white border border-slate-205 rounded-xl shadow-lg z-50 overflow-hidden"
                        >
                          <div className="py-1">
                            {statusOptions.map(status => (
                              <button
                                key={status.value}
                                onClick={() => {
                                  handleBulkStatus(status.value)
                                  setStatusOpen(false)
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold text-slate-800"
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Export Action Button */}
                <button
                  onClick={handleBulkExport}
                  disabled={loading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-emerald-500 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-3xs active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>

                {/* Clear Desktop Trigger Button */}
                <button
                  onClick={() => onSelectionChange([])}
                  className="hidden sm:inline-flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98]"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
