'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Plus, Pencil, Search, X } from 'lucide-react'
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

export default function ChecklistTemplatesManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(initialTemplates)
  const [search, setSearch] = useState('')

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description?.toLowerCase() ?? '').includes(search.toLowerCase())
  )

  // Handle deletion update in local state
  function handleDeleteSuccess(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No checklist templates yet"
        description="Create reusable checklists that automatically apply to PM schedules."
        action={
          <Link href="/settings/checklist-templates/new" className="btn-primary text-sm">
            Create first template
          </Link>
        }
        icon={<ClipboardCheck className="w-7 h-7" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header / Search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search checklist templates…"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
          <ClipboardCheck className="w-4 h-4" />
          <span>{templates.length} total</span>
        </div>

        <Link href="/settings/checklist-templates/new" className="btn-primary text-sm flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          New template
        </Link>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No checklist templates match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="text-sm text-blue-600 hover:underline mt-1">
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Template</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Types</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Mandatory</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Used in</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTemplates.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-400 truncate max-w-xs">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {t.items.length} item{t.items.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const typeCounts = t.items.reduce<Record<string, number>>((acc, i) => {
                        const t = i.type || 'CHECKBOX'
                        acc[t] = (acc[t] || 0) + 1
                        return acc
                      }, {})
                      return Object.entries(typeCounts).map(([type, count]) => (
                        <span key={type} className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-2xs font-medium mr-1">
                          {count} {type === 'CHECKBOX' ? '☑' : type === 'TEXT_INPUT' ? 'Aa' : type === 'NUMBER_INPUT' ? '#0' : type === 'SINGLE_SELECT' ? '▼' : type === 'INSPECTION' ? '✓✗' : '✍'}
                        </span>
                      ))
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {t.items.filter(i => i.isMandatory).length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                        {t.items.filter(i => i.isMandatory).length} required
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {t._count.pmSchedules > 0 ? (
                      <span>{t._count.pmSchedules} PM schedule{t._count.pmSchedules !== 1 ? 's' : ''}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/settings/checklist-templates/${t.id}/edit`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Link>
                      <DeleteChecklistTemplateButton
                        id={t.id}
                        name={t.name}
                        onSuccess={() => handleDeleteSuccess(t.id)}
                      />
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
