'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Plus, Pencil, Search, X, Layers } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import DeleteChecklistTemplateButton from '@/components/DeleteChecklistTemplateButton'

interface ChecklistItem {
  id: string
  type: string
  isMandatory: boolean
}

interface ChecklistTemplate {
  id: string
  name: string
  description: string | null
  items: ChecklistItem[]
  _count: { pmSchedules: number }
}

interface Props {
  initialTemplates: ChecklistTemplate[]
}

const TYPE_SYMBOLS: Record<string, { label: string; icon: string }> = {
  CHECKBOX:      { label: 'Checkbox', icon: '☑' },
  TEXT_INPUT:    { label: 'Text',     icon: 'Aa' },
  NUMBER_INPUT:  { label: 'Number',   icon: '#0' },
  SINGLE_SELECT: { label: 'Select',   icon: '▼' },
  INSPECTION:    { label: 'Pass/Fail', icon: '✓✗' },
  SIGNATURE:     { label: 'Sign',     icon: '✍' },
}

export default function ChecklistTemplatesManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(initialTemplates)
  const [search, setSearch] = useState('')

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description?.toLowerCase() ?? '').includes(search.toLowerCase())
  )

  function handleDeleteSuccess(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No checklist templates yet"
        description="Create reusable checklists that automatically apply to PM schedules."
        action={
          <Link href="/settings/checklist-templates/new" className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Create first template</span>
          </Link>
        }
        icon={<ClipboardCheck className="w-8 h-8 text-blue-600" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header / Search row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search checklist templates by name or description…"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50 flex-shrink-0">
            <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>{templates.length} total templates</span>
          </div>

          <Link href="/settings/checklist-templates/new" className="btn-primary text-sm flex items-center justify-center gap-1.5 flex-shrink-0 flex-1 sm:flex-initial shadow-sm">
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </Link>
        </div>
      </div>

      {/* Main Listing Grid/Table */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 px-4 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No matching templates found</p>
          <p className="text-slate-400 text-sm mt-1">Try modifying your search terms.</p>
          <button onClick={() => setSearch('')} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors">
            Reset checklist search
          </button>
        </div>
      ) : (
        <div className="responsive-table-container">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Template Detail</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Task Items</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Configuration Types</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Required Status</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">PM Link Count</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTemplates.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 py-4.5">
                    <p className="font-bold text-slate-800 tracking-tight leading-snug">{t.name}</p>
                    {t.description ? (
                      <p className="text-xs text-slate-450 truncate max-w-xs md:max-w-md mt-1 leading-normal">{t.description}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-0.5">No description provided</p>
                    )}
                  </td>
                  
                  <td className="px-4 py-4.5 hidden md:table-cell">
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100/40">
                      {t.items.length} item{t.items.length !== 1 ? 's' : ''}
                    </span>
                  </td>

                  <td className="px-4 py-4.5">
                    {(() => {
                      const typeCounts = t.items.reduce<Record<string, number>>((acc, i) => {
                        const t = i.type || 'CHECKBOX'
                        acc[t] = (acc[t] || 0) + 1
                        return acc
                      }, {})
                      const entries = Object.entries(typeCounts)
                      if (entries.length === 0) return <span className="text-xs text-slate-400 italic">Empty checklist</span>
                      return (
                        <div className="flex flex-wrap gap-1">
                          {entries.map(([type, count]) => {
                            const sym = TYPE_SYMBOLS[type] || { label: type, icon: '☑' }
                            return (
                              <span 
                                key={type} 
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-extrabold tracking-wide uppercase border border-slate-200/50"
                                title={`${count} ${sym.label} steps`}
                              >
                                <span className="text-slate-400">{sym.icon}</span>
                                <span>{count}</span>
                              </span>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </td>

                  <td className="px-4 py-4.5 hidden sm:table-cell">
                    {t.items.filter(i => i.isMandatory).length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-750 border border-red-100/50 rounded-full text-[11px] font-extrabold tracking-wide uppercase">
                        {t.items.filter(i => i.isMandatory).length} mandatory
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium select-none">—</span>
                    )}
                  </td>

                  <td className="px-4 py-4.5 text-xs font-semibold text-slate-500 hidden lg:table-cell">
                    {t._count.pmSchedules > 0 ? (
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-205">
                        {t._count.pmSchedules} PM schedule{t._count.pmSchedules !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-normal">Unused</span>
                    )}
                  </td>

                  <td className="px-4 py-4.5">
                    <div className="flex items-center gap-2.5 justify-end">
                      <Link 
                        href={`/settings/checklist-templates/${t.id}/edit`}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50/50 p-1 px-2.5 rounded-lg transition-all shadow-3xs"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-450" /> 
                        <span>Edit</span>
                      </Link>
                      
                      <div className="flex items-center border-l border-slate-200 pl-2.5">
                        <DeleteChecklistTemplateButton
                          id={t.id}
                          name={t.name}
                          onSuccess={() => handleDeleteSuccess(t.id)}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
