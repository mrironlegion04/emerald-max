'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Check, 
  FileText, 
  ExternalLink, 
  Eye, 
  Loader2, 
  Search, 
  AlertCircle, 
  X, 
  ChevronRight, 
  Download, 
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react'

// ── Types Matching Prisma Schema ─────────────────────────────────────────────

interface StepAttachment {
  id: string
  filename: string
  url: string
  mimeType: string | null
  size: number | null
}

interface MaintenanceStep {
  id: string
  label: string
  type: string
  isMandatory: boolean
  sortOrder: number
  attachments: StepAttachment[]
}

interface MaintenanceProcedure {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  steps: MaintenanceStep[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function TechnicianProcedureView() {
  // States
  const [procedures, setProcedures] = useState<MaintenanceProcedure[]>([])
  const [selectedId, setSelectedId] = useState<string>('sample-1')
  const [activeProcedure, setActiveProcedure] = useState<MaintenanceProcedure | null>(null)
  
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  
  // Mobile search state for steps
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // Interactive checklist execution state
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({})
  const [stepInputValues, setStepInputValues] = useState<Record<string, string>>({})
  
  // Document preview modal states
  const [previewAttachment, setPreviewAttachment] = useState<StepAttachment | null>(null)

  // Fetch all premium procedures on mount
  useEffect(() => {
    async function loadAllProcedures() {
      try {
        setIsLoading(true)
        const res = await fetch('/api/maintenance-procedures')
        if (!res.ok) throw new Error('Failed to fetch procedures list')
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setProcedures(data)
          // Default to first procedure
          setSelectedId(data[0].id)
        } else {
          setError('No maintenance procedures available.')
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error occurred while loading procedures.')
      } finally {
        setIsLoading(false)
      }
    }
    loadAllProcedures()
  }, [])

  // Fetch specific procedure when selection changes
  useEffect(() => {
    if (!selectedId) return
    
    async function loadProcedureDetails() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/maintenance-procedures/${selectedId}`)
        if (!res.ok) throw new Error('Failed to load procedure details')
        const data = await res.json()
        setActiveProcedure(data)
        
        // Reset checklist state for new procedure
        setCheckedSteps({})
        setStepInputValues({})
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error loading procedure steps.')
      } finally {
        setIsLoading(false)
      }
    }
    loadProcedureDetails()
  }, [selectedId])

  // Computed state
  const totalStepCount = activeProcedure?.steps?.length || 0
  const completedStepCount = activeProcedure?.steps?.filter(step => {
    if (step.type === 'TEXT_INPUT' || step.type === 'NUMBER_INPUT') {
      return !!stepInputValues[step.id]?.trim()
    }
    return !!checkedSteps[step.id]
  }).length || 0
  
  const progressPercent = totalStepCount > 0 
    ? Math.round((completedStepCount / totalStepCount) * 100) 
    : 0

  // Filtered steps list
  const filteredSteps = activeProcedure?.steps?.filter(step => 
    step.label.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  // Toggle step completion status
  const handleToggleStep = (stepId: string) => {
    setCheckedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  // Handle textbox/number values
  const handleInputChange = (stepId: string, val: string) => {
    setStepInputValues(prev => ({
      ...prev,
      [stepId]: val
    }))
  }

  return (
    <div id="technician-mobile-sandbox" className="w-full max-w-md mx-auto bg-gray-50 border border-gray-200 min-h-[700px] flex flex-col shadow-xl rounded-3xl overflow-hidden font-sans class-component-container">
      
      {/* Dynamic Status / Network bar simulated elegantly for Mobile context */}
      <div id="mobile-top-bar" className="bg-slate-900 px-5 pt-3 pb-2 flex justify-between items-center text-xs text-slate-400 border-b border-slate-800">
        <span className="font-mono tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          FIELD TECH REMOTE
        </span>
        <span className="font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] sm:text-xs">
          ID: {selectedId}
        </span>
      </div>

      {/* Styled Mobile Header & Sticky Title Area */}
      <div id="procedures-header" className="bg-slate-900 text-white p-5 shadow-md">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <h1 className="text-lg font-bold tracking-tight text-white line-clamp-2">
              🔧 SOP Instructions
            </h1>
            <button 
              onClick={() => {
                // Re-fetch current procedure to reset
                const oldId = selectedId
                setSelectedId('')
                setTimeout(() => setSelectedId(oldId), 50)
              }}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition duration-200"
              title="Reset Checklist"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Selector dropdown for matching standard procedures */}
          <div className="relative">
            <select
              id="procedure-picker-input"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2.5 pr-8 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium appearance-none"
            >
              {procedures.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-450 text-slate-400">
              <ChevronRight className="h-4 w-4 transform rotate-90" />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Checklist progress area */}
      {activeProcedure && (
        <div id="mobile-progress-wrapper" className="bg-white border-b border-gray-200 px-5 py-3 flex flex-col gap-1.5 shadow-sm">
          <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
            <span>SOP PROGRESS</span>
            <span className="text-sky-600 font-bold">{progressPercent}% DONE</span>
          </div>
          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <motion.div 
              className="bg-sky-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
            {activeProcedure.description || 'Follow instructions precisely.'}
          </p>
        </div>
      )}

      {/* Search Bar filter */}
      <div id="utility-search-box" className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            id="steps-search"
            type="text"
            placeholder="Search procedure steps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 pl-9 pr-4 py-1.5 rounded-lg text-xs font-normal focus:outline-none focus:ring-1 focus:ring-sky-500 text-gray-700"
          />
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-xs text-gray-400 hover:text-gray-600 font-semibold px-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main checklist dynamic steps body */}
      <div id="mobile-checklist-canvas" className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[480px]">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
              <p className="text-xs text-gray-500 font-medium font-mono">LOADING PROCEDURES...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center my-6">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-rose-700">{error}</p>
              <button 
                onClick={() => setSelectedId('sample-1')}
                className="mt-3 bg-rose-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-rose-700"
              >
                Reset to Demo SOP
              </button>
            </div>
          ) : filteredSteps.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs">No matching steps found.</p>
            </div>
          ) : (
            filteredSteps.map((step, idx) => {
              const checked = !!checkedSteps[step.id]
              const hasVal = !!stepInputValues[step.id]?.trim()
              const isFilledInput = step.type === 'TEXT_INPUT' || step.type === 'NUMBER_INPUT' ? hasVal : checked

              return (
                <motion.div
                  key={step.id}
                  id={`procedure-step-row-${step.id}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className={`border p-4 rounded-xl flex flex-col gap-3 transition-shadow duration-200 overflow-hidden relative ${
                    isFilledInput 
                      ? 'bg-emerald-50/70 border-emerald-200/80 shadow-sm' 
                      : 'bg-white border-gray-200 hover:shadow-md'
                  }`}
                >
                  {/* Row main interaction content */}
                  <div className="flex items-start gap-4">
                    {/* Tick checkbox helper or step index */}
                    {step.type === 'CHECKBOX' ? (
                      <button
                        onClick={() => handleToggleStep(step.id)}
                        className={`mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 pointer-events-auto cursor-pointer ${
                          checked 
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 scale-105 border-transparent' 
                            : 'border-2 border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                        style={{ minWidth: '24px', minHeight: '24px' }}
                      >
                        {checked && <Check className="h-4 w-4 stroke-[3]" />}
                      </button>
                    ) : (
                      <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center font-mono text-xs font-semibold text-slate-500 flex-shrink-0">
                        {idx + 1}
                      </div>
                    )}

                    {/* Instruction Label & Details */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {step.isMandatory && (
                          <span className="bg-red-50 border border-red-200 text-red-600 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider font-mono">
                            REQUIRED
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                          {step.type.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <p className={`text-xs sm:text-sm font-medium leading-relaxed ${
                        isFilledInput ? 'text-slate-800 line-through decoration-emerald-500/35' : 'text-slate-700'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                  </div>

                  {/* Input entry elements if TEXT_INPUT or NUMBER_INPUT type */}
                  {(step.type === 'TEXT_INPUT' || step.type === 'NUMBER_INPUT') && (
                    <div className="pl-10 mt-1 max-w-full">
                      <input
                        type={step.type === 'NUMBER_INPUT' ? 'number' : 'text'}
                        placeholder={step.type === 'NUMBER_INPUT' ? 'Enter measure value...' : 'Enter note/observations...'}
                        value={stepInputValues[step.id] || ''}
                        onChange={(e) => handleInputChange(step.id, e.target.value)}
                        className={`w-full text-xs px-3 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all duration-200 ${
                          hasVal ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200'
                        }`}
                      />
                    </div>
                  )}

                  {/* SPECIFIC CRITICAL REQUIREMENT: Loop Step Attachments and display "View Document" button */}
                  {step.attachments && step.attachments.length > 0 && (
                    <div className="pl-10 flex flex-col gap-1.5 mt-1 border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-semibold text-slate-400/90 tracking-wide font-mono uppercase">
                        SOP ATTACHED SCHEMATICS & MANUALS:
                      </span>
                      {step.attachments.map((att) => (
                        <div 
                          key={att.id} 
                          className="flex flex-col gap-1 w-full"
                          id={`step-attachment-node-${att.id}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              // Store active attachment to trigger nice preview modal
                              setPreviewAttachment(att)
                            }}
                            className="flex items-center justify-between w-full text-left bg-sky-50 border border-sky-100 hover:bg-sky-100 hover:border-sky-200 text-sky-800 px-3 py-2.5 rounded-xl text-xs font-semibold transition duration-200 cursor-pointer pointer-events-auto focus:ring-2 focus:ring-sky-500"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <FileText className="h-4 w-4 text-sky-600 flex-shrink-0" />
                              <span className="truncate max-w-[180px] sm:max-w-xs block text-sky-900 font-bold">
                                {att.filename}
                              </span>
                            </span>
                            <span className="flex items-center gap-1.5 text-sky-600 shrink-0 select-none">
                              {att.size && (
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 font-medium px-1 rounded">
                                  {formatBytes(att.size)}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-sky-700 hover:underline flex items-center gap-0.5">
                                View Document ➡️
                              </span>
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Completion congratulations footer */}
      {activeProcedure && !isLoading && !error && progressPercent === 100 && (
        <motion.div 
          id="completion-congrats-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500 text-white p-4 text-center select-none"
        >
          <div className="flex justify-center items-center gap-1.5 text-sm font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-5 w-5 stroke-2" />
            ALL STEPS COMPLETED
          </div>
          <p className="text-[11px] text-emerald-100 mt-1">
            Procedure results are validated, safe to sign off.
          </p>
        </motion.div>
      )}

      {/* Embedded Document Previewer Modal */}
      <AnimatePresence>
        {previewAttachment && (
          <motion.div 
            id="attachment-preview-backstage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
          >
            <motion.div
              id="attachment-frame-container"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200"
            >
              {/* Premium Modal Header */}
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center select-none">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-sky-400" />
                  <div className="flex flex-col">
                    <h3 className="text-xs font-bold leading-none truncate max-w-[200px]">
                      {previewAttachment.filename}
                    </h3>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {previewAttachment.mimeType || 'application/pdf'} {previewAttachment.size ? `• ${formatBytes(previewAttachment.size)}` : ''}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Simulated Document content viewport */}
              <div className="bg-slate-100 p-6 flex flex-col items-center justify-center text-center border-b border-gray-100 min-h-[220px]">
                <div className="bg-sky-100/70 p-4 rounded-full mb-3 text-sky-600">
                  <FileSpreadsheet className="h-10 w-10 animate-pulse text-sky-600" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">
                  Secure SOP Manual Document
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                  Authorized by Maintenance Reliability Engineering team.
                </p>

                {/* Secure warning disclaimer */}
                <span className="font-mono text-[9px] bg-slate-200/60 text-slate-500 mt-4 px-2 py-0.5 rounded uppercase font-bold tracking-wider select-none">
                  CONFIDENTIAL TECHNICAL SOP
                </span>
              </div>

              {/* Action utilities - Standard browser capabilities */}
              <div className="p-3 bg-gray-50 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-700 text-xs rounded-lg font-bold border border-gray-200"
                >
                  Close
                </button>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 transition select-none"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open PDF Standard
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
