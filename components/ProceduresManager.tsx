'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Plus, Pencil, Search, X, LayoutGrid, List, MapPin, FolderTree, Building2, Users } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import DeleteProcedureButton from '@/components/DeleteProcedureButton'

interface ProcedureStep {
  id: string
  type: string
  isMandatory: boolean
}

interface Procedure {
  id: string
  name: string
  description: string | null
  steps: ProcedureStep[]
  team?: { id: string; name: string } | null
  locations?: { id: string; name: string }[]
  categories?: { id: string; name: string }[]
  assets?: { id: string; name: string }[]
  _count: { pmSchedules: number }
}

interface Props {
  initialProcedures: Procedure[]
}

const TYPE_SYMBOLS: Record<string, { label: string; icon: string }> = {
  CHECKBOX:      { label: 'Checkbox', icon: '☑' },
  TEXT_INPUT:    { label: 'Text',     icon: 'Aa' },
  NUMBER_INPUT:  { label: 'Number',   icon: '#0' },
  SINGLE_SELECT: { label: 'Select',   icon: '▼' },
  INSPECTION:    { label: 'Pass/Fail', icon: '✓✗' },
  SIGNATURE:     { label: 'Sign',     icon: '✍' },
  YES_NO_NA:     { label: 'Yes/No/NA', icon: '✓✗-' },
  AMOUNT:        { label: 'Amount',   icon: '$' },
}

export default function ProceduresManager({ initialProcedures }: Props) {
  const [procedures, setProcedures] = useState<Procedure[]>(initialProcedures)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAsset, setFilterAsset] = useState('')
  const [filterTeam, setFilterTeam] = useState('')

  // Extract unique values for filters
  const allLocations = Array.from(new Map(procedures.flatMap(p => p.locations ?? []).map(l => [l.id, l])).values())
  const allCategories = Array.from(new Map(procedures.flatMap(p => p.categories ?? []).map(c => [c.id, c])).values())
  const allAssets = Array.from(new Map(procedures.flatMap(p => p.assets ?? []).map(a => [a.id, a])).values())
  const allTeams = Array.from(new Map(procedures.filter(p => p.team).map(p => p.team!).map(t => [t.id, t])).values())

  const filteredProcedures = procedures.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase() ?? '').includes(search.toLowerCase())
    const matchesLocation = !filterLocation || p.locations?.some(l => l.id === filterLocation)
    const matchesCategory = !filterCategory || p.categories?.some(c => c.id === filterCategory)
    const matchesAsset = !filterAsset || p.assets?.some(a => a.id === filterAsset)
    const matchesTeam = !filterTeam || p.team?.id === filterTeam
    return matchesSearch && matchesLocation && matchesCategory && matchesAsset && matchesTeam
  })

  function handleDeleteSuccess(id: string) {
    setProcedures(prev => prev.filter(t => t.id !== id))
  }

  if (procedures.length === 0) {
    return (
      <EmptyState
        title="No Procedures yet"
        description="Create reusable step-by-step procedures that automatically apply to work orders."
        action={
          <Link href="/procedures/new" className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Create first procedure</span>
          </Link>
        }
        icon={<ClipboardCheck className="w-8 h-8 text-blue-600" />}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search procedures by name or description..."
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white outline-none cursor-pointer">
            <option value="">All Locations</option>
            {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white outline-none cursor-pointer">
            <option value="">All Categories</option>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white outline-none cursor-pointer">
            <option value="">All Assets</option>
            {allAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {allTeams.length > 0 && (
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white outline-none cursor-pointer">
              <option value="">All Teams</option>
              {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50">
            <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>{filteredProcedures.length} of {procedures.length}</span>
          </div>

          <Link href="/procedures/new" className="btn-primary text-sm flex items-center justify-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            <span>New Procedure</span>
          </Link>
        </div>
      </div>

      {/* Procedure Cards */}
      {filteredProcedures.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 px-4 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No matching procedures found</p>
          <p className="text-slate-400 text-sm mt-1">Try modifying your search or filters.</p>
          <button onClick={() => { setSearch(''); setFilterLocation(''); setFilterCategory(''); setFilterAsset(''); setFilterTeam('') }} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors">
            Reset all filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProcedures.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors">{p.name}</h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link href={`/procedures/${p.id}/edit`} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <DeleteProcedureButton id={p.id} name={p.name} onSuccess={() => handleDeleteSuccess(p.id)} />
                </div>
              </div>

              {p.description && (
                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{p.description}</p>
              )}

              {/* Tags Row */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.team && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200/50">
                    <Users className="w-2.5 h-2.5" />{p.team.name}
                  </span>
                )}
                {(p.locations ?? []).slice(0, 2).map(loc => (
                  <span key={loc.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200/50">
                    <MapPin className="w-2.5 h-2.5" />{loc.name}
                  </span>
                ))}
                {(p.categories ?? []).slice(0, 2).map(cat => (
                  <span key={cat.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200/50">
                    <FolderTree className="w-2.5 h-2.5" />{cat.name}
                  </span>
                ))}
                {(p.assets ?? []).slice(0, 1).map(asset => (
                  <span key={asset.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-full border border-orange-200/50">
                    <Building2 className="w-2.5 h-2.5" />{asset.name}
                  </span>
                ))}
                {((p.locations?.length ?? 0) + (p.categories?.length ?? 0) + (p.assets?.length ?? 0)) > 5 && (
                  <span className="text-[10px] text-slate-400 font-bold">+{(p.locations?.length ?? 0) + (p.categories?.length ?? 0) + (p.assets?.length ?? 0) - 5} more</span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {p.steps.length} step{p.steps.length !== 1 ? 's' : ''}
                  </span>
                  {p.steps.filter(s => s.isMandatory).length > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/40">
                      {p.steps.filter(s => s.isMandatory).length} required
                    </span>
                  )}
                </div>
                {p._count.pmSchedules > 0 && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    {p._count.pmSchedules} PM{p._count.pmSchedules !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Procedure</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Tags</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Steps</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProcedures.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                    <p className="text-xs text-slate-450 truncate max-w-xs mt-0.5">{p.description || 'No description'}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.team && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded">{p.team.name}</span>}
                      {(p.locations ?? []).slice(0, 2).map(l => <span key={l.id} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded">{l.name}</span>)}
                      {(p.categories ?? []).slice(0, 2).map(c => <span key={c.id} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded">{c.name}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{p.steps.length}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Link href={`/procedures/${p.id}/edit`} className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50/50 p-1 px-2.5 rounded-lg transition-all shadow-3xs">
                        <Pencil className="w-3 h-3 inline mr-1" />Edit
                      </Link>
                      <DeleteProcedureButton id={p.id} name={p.name} onSuccess={() => handleDeleteSuccess(p.id)} />
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
