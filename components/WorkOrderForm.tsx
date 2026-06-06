'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Star, Eye, Check, Square, AlertCircle, FileText, Calendar, PenTool, Hash, FileDown, CheckSquare, Search, Folder, Camera, ListTodo, Sliders, X } from 'lucide-react'
import WorkOrderIssueSelector, { OTHER_ISSUE } from './WorkOrderIssueSelector'
import AssetTreeSelect from './AssetTreeSelect'
import LocationSelect from './LocationSelect'

interface Asset { id: string; name: string; assetCode: string | null; imageUrl?: string | null; categoryId?: string | null; parentId?: string | null; locationId?: string | null; domainId?: string | null }
interface Location { id: string; name: string; address: string | null; path: string | null; parentId: string | null }
interface User  { id: string; name: string; role: string }
interface DomainGroup { id: string; name: string; issues: { id: string; code: string; title: string; severity?: string }[]; isFallback?: boolean }

interface ProcedureStep {
  id: string
  label: string
  type: string
  isMandatory: boolean
  options: string[]
  sortOrder: number
}

interface Procedure {
  id: string; name: string; description?: string | null; steps?: ProcedureStep[]
  locations?: { id: string }[]
  categories?: { id: string }[]
  assets?: { id: string }[]
}

interface WOFormData {
  title: string; description: string; type: string; priority: string
  status: string; dueDate: string; assetId: string; locationId: string; locationScope: string
  selectedAssetIds: string[]
  assignedToId: string; assignedDomainId: string; laborHours: string; laborCost: string; partsCost: string
  notes: string; issueId: string; customIssue: string;
  procedureIds: string[]
}

interface Props {
  assets: Asset[]; locations: Location[]; users: User[]; domains: { id: string; name: string }[]
  procedures?: Procedure[]
  initialData?: Partial<WOFormData>
  woId?: string
  preselectedAssetId?: string
}

const typeOptions     = ['BREAKDOWN','PREVENTIVE','PREDICTIVE']
const priorityOptions = ['LOW','MEDIUM','HIGH','CRITICAL']
const statusOptions   = ['OPEN','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED']
const typeLabels: Record<string,string>     = { BREAKDOWN:'Breakdown', PREVENTIVE:'Preventive', PREDICTIVE:'Predictive' }
const priorityLabels: Record<string,string> = { LOW:'Low', MEDIUM:'Medium', HIGH:'High', CRITICAL:'Critical' }
const statusLabels: Record<string,string>   = { OPEN:'Open', IN_PROGRESS:'In Progress', ON_HOLD:'On Hold', COMPLETED:'Completed', CANCELLED:'Cancelled' }

export default function WorkOrderForm({ assets, locations, users, domains = [], procedures = [], initialData, woId, preselectedAssetId }: Props) {
  const router = useRouter()
  const isEdit = !!woId

  // Map checklists to procedures
  const initialProcedures = initialData?.procedureIds || []

  const [form, setForm] = useState<WOFormData>({
    title:          initialData?.title          ?? '',
    description:    initialData?.description    ?? '',
    type:           initialData?.type           ?? 'BREAKDOWN',
    priority:       initialData?.priority       ?? 'MEDIUM',
    status:         initialData?.status         ?? 'OPEN',
    dueDate:        initialData?.dueDate        ?? '',
    assetId:        initialData?.assetId        ?? preselectedAssetId ?? '',
    locationId:     initialData?.locationId     ?? '',
    locationScope:  initialData?.locationScope  ?? 'ALL_ASSETS',
    selectedAssetIds: [],
    assignedToId:   initialData?.assignedToId   ?? '',
    assignedDomainId: initialData?.assignedDomainId ?? (preselectedAssetId ? (assets.find(a => a.id === preselectedAssetId)?.domainId ?? '') : ''),
    laborHours:     initialData?.laborHours     ?? '',
    laborCost:      initialData?.laborCost      ?? '',
    partsCost:      initialData?.partsCost      ?? '',
    notes:          initialData?.notes          ?? '',
    issueId:        initialData?.customIssue    ? OTHER_ISSUE : (initialData?.issueId ?? ''),
    customIssue:    initialData?.customIssue    ?? '',
    procedureIds:   initialProcedures,
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [isTitleDirty, setIsTitleDirty] = useState(isEdit ? true : false)

  const [targetType, setTargetType] = useState<'ASSET' | 'LOCATION'>(
    (initialData?.locationId && !initialData?.assetId && !preselectedAssetId) ? 'LOCATION' : 'ASSET'
  )

  const [previewProcedureId, setPreviewProcedureId] = useState<string | null>(null)
  const [procedureSearchQuery, setProcedureSearchQuery] = useState<string>('')

  const [assetMode, setAssetMode] = useState<'single' | 'multi'>(
    (initialData?.selectedAssetIds && initialData.selectedAssetIds.length > 1) ? 'multi' : 'single'
  )

  const handleToggleTarget = (type: 'ASSET' | 'LOCATION') => {
    setTargetType(type)
    if (type === 'ASSET') {
      setForm(prev => ({ ...prev, locationId: '', locationScope: 'ALL_ASSETS', selectedAssetIds: [] }))
    } else {
      setForm(prev => ({ ...prev, assetId: '', selectedAssetIds: [], issueId: '', customIssue: '' }))
    }
  }

  // ── Issue groups fetched dynamically when asset or location changes ──
  const [issueGroups, setIssueGroups] = useState<DomainGroup[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)

  const allSelectedAssetIds = [...new Set([
    ...(form.assetId ? [form.assetId] : []),
    ...form.selectedAssetIds,
  ])]
  const primaryAssetId = form.assetId || form.selectedAssetIds[0] || ''
  const selectedAsset = assets.find(a => a.id === primaryAssetId)

  useEffect(() => {
    const categoryId = selectedAsset?.categoryId
    if (!primaryAssetId && !form.locationId) { setIssueGroups([]); return }
    setLoadingIssues(true)
    fetch(`/api/issues?categoryId=${categoryId ?? ''}`)
      .then(r => r.json())
      .then((groups: DomainGroup[]) => {
        setIssueGroups(groups)
        const allIds = groups.flatMap(g => g.issues.map(i => i.id))
        setForm(prev => {
          if (prev.issueId === OTHER_ISSUE) return prev
          return { ...prev, issueId: allIds.includes(prev.issueId) ? prev.issueId : '' }
        })
      })
      .catch(() => setIssueGroups([]))
      .finally(() => setLoadingIssues(false))
  }, [primaryAssetId, form.locationId, selectedAsset?.categoryId])

  function set(field: keyof WOFormData, value: string | string[]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'assetId' && typeof value === 'string' && value) {
        const assetObj = assets.find(a => a.id === value)
        if (assetObj?.domainId) {
          next.assignedDomainId = assetObj.domainId
          next.assignedToId = '' // Clear individual assignee to avoid conflict
        }
      }
      return next
    })
  }

  function generateTitle(assetIds: string[], selectedAssetIds: string[], type: string, issueId: string, customIssue: string): string {
    const allIds = [...new Set([...assetIds.filter(Boolean), ...selectedAssetIds])]
    if (allIds.length === 0) return ''

    const names = allIds.map(id => assets.find(a => a.id === id)?.name).filter(Boolean) as string[]

    const buildSuffix = () => {
      if (issueId === OTHER_ISSUE && customIssue.trim()) return customIssue.trim()
      if (issueId && issueId !== OTHER_ISSUE) {
        const issue = issueGroups.flatMap(g => g.issues).find(i => i.id === issueId)
        if (issue) return issue.title
      }
      return null
    }

    const suffix = buildSuffix()
    if (allIds.length > 1) {
      const prefix = suffix ? `${names[0]} +${allIds.length - 1}` : `${typeLabels[type] || type} - ${names[0]} +${allIds.length - 1}`
      return suffix ? `${prefix} - ${suffix}` : prefix
    }

    const prefix = suffix || `${typeLabels[type] || type}`
    return `${prefix} - ${names[0]}`
  }

  useEffect(() => {
    if (!isTitleDirty && primaryAssetId) {
      const newTitle = generateTitle(form.assetId ? [form.assetId] : [], form.selectedAssetIds, form.type, form.issueId, form.customIssue)
      if (newTitle && newTitle !== form.title) setForm(prev => ({ ...prev, title: newTitle }))
    }
  }, [primaryAssetId, form.type, form.issueId, form.customIssue, issueGroups, isTitleDirty, form.selectedAssetIds])

  const suggestedTitle = generateTitle(form.assetId ? [form.assetId] : [], form.selectedAssetIds, form.type, form.issueId, form.customIssue)

  // Smart recommendation
  const recommendedIds = useMemo(() => {
    const ids = new Set<string>()
    if (!primaryAssetId && !form.locationId) return ids

    const allAssetIdsForRec = allSelectedAssetIds
    const categoryIds = new Set(allAssetIdsForRec.map(id => assets.find(a => a.id === id)?.categoryId).filter(Boolean))

    for (const p of procedures) {
      const matchesAsset    = allAssetIdsForRec.some(aid => p.assets?.some(a => a.id === aid))
      const matchesCategory = categoryIds.size > 0 && [...categoryIds].some(cid => p.categories?.some(c => c.id === cid))
      const matchesLocation = form.locationId && p.locations?.some(l => l.id === form.locationId)
      if (matchesAsset || matchesCategory || matchesLocation) ids.add(p.id)
    }
    return ids
  }, [primaryAssetId, allSelectedAssetIds, form.locationId, procedures, assets])

  const sortedProcedures = useMemo(() => {
    return [...procedures].sort((a, b) => {
      const aRec = recommendedIds.has(a.id) ? 0 : 1
      const bRec = recommendedIds.has(b.id) ? 0 : 1
      return aRec - bRec
    })
  }, [procedures, recommendedIds])

  const filteredProcedures = useMemo(() => {
    if (!procedureSearchQuery.trim()) return sortedProcedures
    const query = procedureSearchQuery.toLowerCase()
    return sortedProcedures.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    )
  }, [sortedProcedures, procedureSearchQuery])

  const hasRecommendations = recommendedIds.size > 0 && (!!primaryAssetId || !!form.locationId)

  useEffect(() => {
    if (!previewProcedureId && filteredProcedures.length > 0) {
      setPreviewProcedureId(filteredProcedures[0].id)
    }
  }, [filteredProcedures, previewProcedureId])

  function toggleProcedure(id: string) {
    setForm(prev => {
      const hasId = prev.procedureIds.includes(id)
      const nextIds = hasId
        ? prev.procedureIds.filter(t => t !== id)
        : [...prev.procedureIds, id]
      return {
        ...prev,
        procedureIds: nextIds,
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      if (!form.title.trim()) { setError('Title is required'); setSaving(false); return }
      if (form.assignedDomainId && form.assignedToId) { setError('Assign to either a domain or an individual, not both'); setSaving(false); return }

      const mergedAssetIds = [
        ...(form.assetId ? [form.assetId] : []),
        ...form.selectedAssetIds,
      ]
      const uniqueAssetIds = [...new Set(mergedAssetIds)]

      const payload = {
        title:        form.title,
        description:  form.description    || null,
        type:         form.type,
        priority:     form.priority,
        status:       form.status,
        dueDate:      form.dueDate        || null,
        assetId:      form.assetId        || null,
        locationId:   form.locationId     || null,
        locationScope: form.locationId && form.selectedAssetIds.length === 0 ? form.locationScope : null,
        selectedAssetIds: uniqueAssetIds,
        assignedToId: form.assignedDomainId ? null : (form.assignedToId || null),
        domainId:     form.assignedDomainId || null,
        laborHours:   form.laborHours     ? parseFloat(form.laborHours)  : null,
        laborCost:    form.laborCost      ? parseFloat(form.laborCost)   : null,
        partsCost:    form.partsCost      ? parseFloat(form.partsCost)   : null,
        notes:        form.notes          || null,
        issueId:      form.issueId === OTHER_ISSUE ? null : (form.issueId || null),
        customIssue:  form.issueId === OTHER_ISSUE ? (form.customIssue || null) : null,
        procedureIds: form.procedureIds,
      }
      const url    = isEdit ? `/api/work-orders/${woId}` : '/api/work-orders'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/work-orders/${data.id}`)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  const inputRow = (label: string, required = false, children: React.ReactNode) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-7 max-w-3xl">
      {error && (
        <div className="bg-rose-50 border border-rose-105 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold shadow-xs">{error}</div>
      )}

      {/* Core info */}
      <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm space-y-5 bg-white">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight pb-3 border-b border-slate-100">Work order details</h2>
        {inputRow('Title', true,
          <div className="space-y-2">
            <input
              type="text"
              value={form.title}
              onChange={e => { setIsTitleDirty(true); set('title', e.target.value) }}
              placeholder={suggestedTitle || 'Enter work order title...'}
              className="input-field text-xs sm:text-sm bg-white"
            />
            {suggestedTitle && !form.title && (
              <p className="text-[11px] text-slate-400 font-medium">
                💡 Suggested: <button type="button" onClick={() => set('title', suggestedTitle)} className="text-blue-600 font-bold hover:underline">{suggestedTitle}</button>
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inputRow('Type', false,
            <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field text-xs sm:text-sm bg-white">
              {typeOptions.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
            </select>
          )}
          {inputRow('Priority', false,
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input-field text-xs sm:text-sm bg-white">
              {priorityOptions.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
            </select>
          )}
          {isEdit && inputRow('Status', false,
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field text-xs sm:text-sm bg-white">
              {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
          )}
          {inputRow('Due date', false,
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className="input-field text-xs sm:text-sm bg-white cursor-pointer" />
          )}
        </div>
        {inputRow('Description', false,
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input-field text-xs sm:text-sm resize-none" rows={3} placeholder="Describe the work to be done..." />
        )}
      </div>

      {/* Assignment */}
      <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm space-y-5 bg-white">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <h2 className="font-bold text-slate-805 text-sm tracking-tight">Work location & scope</h2>
          <div className="flex bg-slate-105 p-0.5 rounded-lg border border-slate-200 shadow-inner-light">
            <button
              type="button"
              onClick={() => handleToggleTarget('ASSET')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                targetType === 'ASSET'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              Asset
            </button>
            <button
              type="button"
              onClick={() => handleToggleTarget('LOCATION')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                targetType === 'LOCATION'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              Location
            </button>
          </div>
        </div>

        {targetType === 'ASSET' ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider">
                {assetMode === 'single' ? 'Asset' : 'Assets'}
              </label>
              <div className="flex bg-slate-105 p-0.5 rounded-lg border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => { setAssetMode('single'); setForm(prev => ({ ...prev, selectedAssetIds: [] })) }}
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition ${
                    assetMode === 'single'
                      ? 'bg-white text-slate-850 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => { setAssetMode('multi'); setForm(prev => ({ ...prev, assetId: '' })) }}
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition ${
                    assetMode === 'multi'
                      ? 'bg-white text-slate-850 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Multi
                </button>
              </div>
            </div>
            {assetMode === 'single' ? (
              <AssetTreeSelect
                assets={assets}
                value={form.assetId}
                onChange={id => set('assetId', id)}
              />
            ) : (
              <AssetTreeSelect
                assets={assets}
                value={form.selectedAssetIds}
                onChange={ids => set('selectedAssetIds', ids)}
                multiSelect={true}
                placeholder="Select multiple assets..."
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">
                Location
              </label>
              <LocationSelect
                locations={locations}
                value={form.locationId}
                onChange={id => set('locationId', id)}
              />
            </div>

            {form.locationId && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">
                    Select specific assets (optional)
                  </label>
                  <p className="text-[11px] text-slate-450 mb-2 font-medium">Leave empty to apply to all location assets with scope selection below</p>
                  <AssetTreeSelect
                    assets={assets.filter(a => a.locationId === form.locationId || assets.filter(x => x.locationId === form.locationId).some(parent => a.parentId === parent.id))}
                    value={form.selectedAssetIds}
                    onChange={ids => set('selectedAssetIds', ids)}
                    multiSelect={true}
                    placeholder="Select assets..."
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Scope of work</p>
                  <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-205/65 rounded-xl hover:bg-slate-50/50 cursor-pointer shadow-xs transition">
                    <input
                      type="radio"
                      name="locationScope"
                      value="ALL_ASSETS"
                      checked={form.locationScope === 'ALL_ASSETS'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800">All Assets in this Location</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-medium">Creates a checklist for each asset recursively</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-205/65 rounded-xl hover:bg-slate-50/50 cursor-pointer shadow-xs transition">
                    <input
                      type="radio"
                      name="locationScope"
                      value="GENERAL"
                      checked={form.locationScope === 'GENERAL'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800">General Maintenance</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-medium">Location-only ticket (no asset checklist)</p>
                    </div>
                  </label>
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {selectedAsset?.imageUrl && assetMode === 'single' && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-705 uppercase tracking-wider mb-2">Asset photo</p>
            <div className="relative w-full max-w-xs aspect-video bg-slate-55 border border-slate-200/50 rounded-xl overflow-hidden shadow-inner-light">
              <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Assign work to:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputRow('Industrial Domain', false,
              <select value={form.assignedDomainId} onChange={e => { set('assignedDomainId', e.target.value); if (e.target.value) set('assignedToId', '') }} className="input-field text-xs sm:text-sm bg-white cursor-pointer">
                <option value="">— No domain —</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {inputRow('Individual', false,
              <select value={form.assignedToId} onChange={e => { set('assignedToId', e.target.value); if (e.target.value) set('assignedDomainId', '') }} className="input-field text-xs sm:text-sm bg-white cursor-pointer">
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Issue selector — shown when an asset or location is selected */}
      {(primaryAssetId && selectedAsset) || form.locationId ? (
        <div className="premium-card p-5 border border-slate-200/50 shadow-sm space-y-4 bg-white">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="font-bold text-slate-805 text-sm tracking-tight">Issue</h2>
            {loadingIssues && <span className="text-[11px] text-slate-400 font-semibold animate-pulse">Loading issues…</span>}
          </div>

          {issueGroups[0]?.isFallback ? (
            // Fallback — location WO, no category, no domains, or domains have no active issues
            <>
              <div className="flex items-center gap-2 mb-2">
                {!form.assetId && form.locationId ? (
                  <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold border border-sky-100 uppercase tracking-wider">Showing general/location issues</span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100 uppercase tracking-wider">Using common issues — no category-specific issues configured for this asset</span>
                )}
              </div>
              <WorkOrderIssueSelector
                groups={issueGroups}
                value={form.issueId}
                onChange={id => set('issueId', id)}
              />
              {form.issueId === OTHER_ISSUE && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={form.customIssue}
                    onChange={e => set('customIssue', e.target.value)}
                    placeholder="Describe the issue..."
                    className="input-field text-xs sm:text-sm bg-white"
                    autoFocus
                  />
                </div>
              )}
            </>
          ) : issueGroups.length > 0 ? (
            // Normal — domain issues available
            <>
              <WorkOrderIssueSelector
                groups={issueGroups}
                value={form.issueId}
                onChange={id => set('issueId', id)}
              />
              {form.issueId === OTHER_ISSUE && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={form.customIssue}
                    onChange={e => set('customIssue', e.target.value)}
                    placeholder="Describe the issue..."
                    className="input-field text-xs sm:text-sm bg-white"
                    autoFocus
                  />
                </div>
              )}
            </>
          ) : !loadingIssues ? (
            // Fetched but both domains and global issues are absent
            <>
              <p className="text-xs text-slate-400 font-medium mb-3">
                {!form.assetId && form.locationId
                  ? 'No general issues available for this location. Describe the problem below.'
                  : 'This asset has no issues configured and no common issues available. Describe the problem below.'}
              </p>
              <input
                type="text"
                value={form.customIssue}
                onChange={e => {
                  set('customIssue', e.target.value)
                  set('issueId', OTHER_ISSUE)
                }}
                placeholder="Describe the issue..."
                className="input-field text-xs sm:text-sm bg-white"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Procedures */}
      {procedures.length > 0 && (
        <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm space-y-4 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600 animate-pulse" />
              <div>
                <h2 className="font-bold text-slate-805 text-sm tracking-tight">Procedures & Checklists</h2>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">MaintainX-Style SOP Engine</p>
              </div>
            </div>
            {form.procedureIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-black rounded-lg shadow-3xs">
                <Check className="w-3.5 h-3.5" />
                {form.procedureIds.length} SOP{form.procedureIds.length !== 1 ? 's' : ''} Attached
              </span>
            )}
          </div>
          
          <p className="text-xs text-slate-450 leading-relaxed font-semibold">
            Search and select any checklist protocol to snap directly into the operator&apos;s mobile execution flow. Use the interactive SOP simulator on the right to dry-run steps prior to dispatch.
          </p>

          {/* Search Bar for Templates */}
          <div className="relative max-w-md pt-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search SOP templates by title, description or steps..."
              value={procedureSearchQuery}
              onChange={(e) => setProcedureSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-8 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs font-semibold focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 placeholder:text-slate-400 placeholder:font-medium"
            />
            {procedureSearchQuery && (
              <button
                type="button"
                onClick={() => setProcedureSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            {/* Left Column: Selector */}
            <div className="lg:col-span-6 space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {/* Recommended list */}
              {hasRecommendations && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                    <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                    Recommended for Asset / Location
                  </div>
                  {filteredProcedures.filter(t => recommendedIds.has(t.id)).map(procedure => {
                    const isSelected = previewProcedureId === procedure.id
                    const isChecked = form.procedureIds.includes(procedure.id)
                    return (
                      <div
                        key={procedure.id}
                        onClick={() => setPreviewProcedureId(procedure.id)}
                        className={`group relative flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-100/50 shadow-md'
                            : 'border-slate-200/80 bg-white hover:border-slate-350 hover:bg-slate-50/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center h-5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleProcedure(procedure.id)}
                            className="w-4.5 h-4.5 text-emerald-600 rounded border-slate-300 cursor-pointer accent-emerald-600 focus:ring-0 focus:ring-offset-0"
                          />
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-slate-805 leading-tight group-hover:text-blue-900 transition">{procedure.name}</p>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-850 text-[8px] font-extrabold rounded-full tracking-wider">
                              REC
                            </span>
                          </div>
                          {procedure.description && (
                            <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[280px]">
                              {procedure.description}
                            </p>
                          )}
                          {procedure.steps && procedure.steps.length > 0 && (
                            <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
                              <ListTodo className="w-3 h-3 text-slate-300" />
                              {procedure.steps.length} {procedure.steps.length === 1 ? 'Step' : 'Steps'} Checklist
                            </p>
                          )}
                        </div>
                        <div className="flex items-center self-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewProcedureId(procedure.id);
                            }}
                            className={`flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-blue-600 bg-blue-50/70 group-hover:bg-blue-100/70 border border-blue-100/30'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {isSelected ? 'Simulating' : 'Simulate'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* All procedures list */}
              <div className="space-y-2">
                {hasRecommendations && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-505 uppercase tracking-wider pt-2 mb-1">
                    All Standard Operating Proposals (SOP)
                  </div>
                )}
                {filteredProcedures.filter(t => !recommendedIds.has(t.id)).map(procedure => {
                  const isSelected = previewProcedureId === procedure.id
                  const isChecked = form.procedureIds.includes(procedure.id)
                  return (
                    <div
                      key={procedure.id}
                      onClick={() => setPreviewProcedureId(procedure.id)}
                      className={`group relative flex items-start gap-4 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-100/50 shadow-md'
                          : 'border-slate-200/80 bg-white hover:border-slate-350 hover:bg-slate-50/50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center h-5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProcedure(procedure.id)}
                          className="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 cursor-pointer accent-blue-600 focus:ring-0 focus:ring-offset-0"
                        />
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-xs font-bold text-slate-805 leading-tight group-hover:text-blue-900 transition">{procedure.name}</p>
                        {procedure.description && (
                          <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[280px]">
                            {procedure.description}
                          </p>
                        )}
                        {procedure.steps && procedure.steps.length > 0 && (
                          <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
                            <ListTodo className="w-3 h-3 text-slate-300" />
                            {procedure.steps.length} {procedure.steps.length === 1 ? 'Step' : 'Steps'} Checklist
                          </p>
                        )}
                      </div>
                      <div className="flex items-center self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewProcedureId(procedure.id);
                          }}
                          className={`flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-blue-600 bg-blue-50/70 group-hover:bg-blue-100/70 border border-blue-100/30'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isSelected ? 'Simulating' : 'Simulate'}
                        </button>
                      </div>
                    </div>
                  )
                })}

                {filteredProcedures.length === 0 && (
                  <div className="text-center py-8 border border-slate-100 bg-slate-50/55 rounded-xl">
                    <Sliders className="w-8 h-8 text-slate-300 mx-auto stroke-1 mb-2" />
                    <p className="text-xs font-bold text-slate-600">No procedures match your search</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Try keywords like &quot;electric&quot;, &quot;hvac&quot;, or &quot;weekly&quot;</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Steps Preview Panel */}
            <div className="lg:col-span-6">
              <div className="lg:sticky lg:top-4 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 min-h-[460px] flex flex-col shadow-inner-light">
                {(() => {
                  const previewProc = procedures.find(p => p.id === previewProcedureId)
                  if (!previewProc) {
                    return (
                      <div className="my-auto flex flex-col items-center justify-center p-6 text-center">
                        <ClipboardCheck className="w-12 h-12 text-blue-550/30 mb-3 stroke-1 animate-bounce" />
                        <h4 className="text-xs font-black text-slate-700">Selecet a checklist template</h4>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[2400px] leading-relaxed font-semibold">
                          Click &quot;Simulate&quot; or select a checklist layout on the left to review step instructions, mandatory field validation, and action types as they will look on the live operator mobile application.
                        </p>
                      </div>
                    )
                  }

                  const isApplied = form.procedureIds.includes(previewProc.id)

                  return (
                    <div className="flex flex-col h-full flex-1 justify-between">
                      {/* Header */}
                      <div className="pb-3.5 border-b border-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-[8px] font-black text-blue-700 bg-blue-100/70 border border-blue-200/50 rounded-full px-2 py-0.5 uppercase tracking-widest font-mono shadow-3xs mb-2">
                              Mobile Simulator: SOP View
                            </span>
                            <h3 className="text-xs font-black text-slate-805 leading-dense pr-1">
                              {previewProc.name}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleProcedure(previewProc.id)}
                            className={`flex items-center gap-1 text-[10px] font-black px-3 py-2 rounded-xl transition-all shadow-xs ${
                              isApplied
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold'
                                : 'bg-blue-600 hover:bg-blue-700 text-white font-extrabold'
                            }`}
                          >
                            {isApplied ? 'Remove SOP' : 'Apply SOP to WO'}
                          </button>
                        </div>
                        {previewProc.description ? (
                          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed font-semibold">
                            {previewProc.description}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-2 italic font-semibold">
                            No protocol description provided.
                          </p>
                        )}
                      </div>

                      {/* Steps List */}
                      <div className="flex-1 py-3.5 overflow-y-auto max-h-[340px] space-y-3.5 pr-1 my-1">
                        <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono mb-1">
                          Checklist Flow ({previewProc.steps?.length || 0} Steps)
                        </p>

                        {previewProc.steps && previewProc.steps.length > 0 ? (
                          previewProc.steps.map((step, idx) => {
                            const isSection = step.type === 'SECTION'
                            const isInstruction = step.type === 'INSTRUCTION'

                            if (isSection) {
                              return (
                                <div key={step.id || idx} className="pt-3 pb-1 first:pt-0 flex items-center gap-2">
                                  <span className="text-[9px] font-black tracking-widest text-slate-700 bg-slate-200/70 border border-slate-300/60 px-2 py-0.5 rounded uppercase font-mono flex items-center gap-1">
                                    <Folder className="w-3 h-3 text-slate-500 fill-slate-300" />
                                    {step.label}
                                  </span>
                                  <div className="h-px bg-slate-200 flex-1"></div>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={step.id || idx}
                                className="flex items-start gap-3 p-3 bg-white border border-slate-200/70 rounded-xl shadow-3xs hover:border-slate-300 transition-all"
                              >
                                {/* Step Type Icons */}
                                <div className="mt-0.5 text-slate-400">
                                  {step.type === 'CHECKBOX' && <Square className="w-4 h-4 text-slate-400" />}
                                  {step.type === 'INSPECTION' && <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-50" />}
                                  {step.type === 'TEXT_INPUT' && <FileText className="w-4 h-4 text-blue-500" />}
                                  {step.type === 'NUMBER_INPUT' && <Hash className="w-4 h-4 text-indigo-500" />}
                                  {step.type === 'SIGNATURE' && <PenTool className="w-4 h-4 text-purple-600" />}
                                  {step.type === 'DATE' && <Calendar className="w-4 h-4 text-amber-500" />}
                                  {step.type === 'METER' && <Sliders className="w-4 h-4 text-teal-500" />}
                                  {step.type === 'PHOTO' && <Camera className="w-4 h-4 text-rose-500" />}
                                  {step.type === 'FILE' && <FileDown className="w-4 h-4 text-indigo-500" />}
                                  {step.type === 'DROPDOWN' && <FileText className="w-4 h-4 text-slate-500" />}
                                  {step.type === 'MULTIPLE_CHOICE' && <CheckSquare className="w-4 h-4 text-violet-500" />}
                                  {isInstruction && <ClipboardCheck className="w-4 h-4 text-cyan-600" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-black text-slate-800 leading-normal">
                                      {step.label}
                                    </span>
                                    {step.isMandatory && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-50 text-amber-800 text-[8px] font-black rounded-full border border-amber-200">
                                        Required *
                                      </span>
                                    )}
                                  </div>

                                  {/* MaintainX Interactive Field Simulators */}
                                  {isInstruction && (
                                    <div className="mt-1.5 pb-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-150 p-2.5 rounded-lg leading-relaxed font-semibold">
                                      {step.label}
                                    </div>
                                  )}

                                  {step.type === 'CHECKBOX' && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <div className="w-5 h-5 rounded border border-slate-350 bg-slate-50 flex items-center justify-center cursor-pointer transition hover:bg-slate-100">
                                        <div className="w-2.5 h-2.5 bg-transparent rounded-sm"></div>
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tap to complete</span>
                                    </div>
                                  )}

                                  {step.type === 'INSPECTION' && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button type="button" className="px-3 py-1 text-[9px] font-black tracking-wider rounded-lg bg-emerald-50 border border-emerald-400 text-emerald-800 hover:bg-emerald-100/70 flex items-center gap-1 cursor-default transition">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div> PASS
                                      </button>
                                      <button type="button" className="px-3 py-1 text-[9px] font-black tracking-wider rounded-lg bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100/70 flex items-center gap-1 cursor-default transition">
                                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500"></div> FAIL
                                      </button>
                                    </div>
                                  )}

                                  {step.type === 'TEXT_INPUT' && (
                                    <div className="mt-1.5">
                                      <input
                                        type="text"
                                        placeholder="Type feedback here as operator..."
                                        disabled
                                        className="w-full max-w-sm px-2.5 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-450 focus:outline-none placeholder:text-slate-400/85"
                                      />
                                    </div>
                                  )}

                                  {step.type === 'NUMBER_INPUT' && (
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <div className="relative max-w-[120px]">
                                        <input
                                          type="number"
                                          placeholder="Value"
                                          disabled
                                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 text-center pr-6"
                                        />
                                        <span className="absolute right-2 top-1.5 text-[9px] font-bold text-slate-450 uppercase">qty</span>
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-400 tracking-wide uppercase">Value response</span>
                                    </div>
                                  )}

                                  {step.type === 'METER' && (
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <div className="relative max-w-[120px]">
                                        <input
                                          type="number"
                                          placeholder="Reading"
                                          disabled
                                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-slate-100/50 rounded-lg text-[10px] font-extrabold text-teal-800 text-center pr-8"
                                        />
                                        <span className="absolute right-2 top-1.5 text-[8px] font-extrabold text-teal-600 uppercase font-mono">units</span>
                                      </div>
                                      <span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">Gauge input</span>
                                    </div>
                                  )}

                                  {step.type === 'SIGNATURE' && (
                                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-250 border-dashed rounded-xl max-w-xs cursor-default">
                                      <div className="h-8 flex items-end justify-center pb-0.5 border-b border-slate-300">
                                        <span className="text-[10px] font-cursive italic text-slate-300">Awaiting technician signature</span>
                                      </div>
                                      <div className="flex justify-between items-center mt-1.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                                          <PenTool className="w-2.5 h-2.5" /> Sign-off verification
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {step.type === 'PHOTO' && (
                                    <div className="mt-2 text-left">
                                      <div className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-rose-300 bg-rose-50/30 rounded-xl text-[10px] text-rose-800 font-extrabold hover:bg-rose-55 hover:text-white transition cursor-pointer">
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Click to simulate photo attachment</span>
                                      </div>
                                    </div>
                                  )}

                                  {step.type === 'DATE' && (
                                    <div className="mt-1.5">
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black text-slate-600">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Select Date & Time</span>
                                      </div>
                                    </div>
                                  )}

                                  {step.type === 'DROPDOWN' && step.options && step.options.length > 0 && (
                                    <div className="mt-1.5">
                                      <div className="inline-block shrink-0 text-[10px] text-slate-650 font-black border border-slate-250 bg-slate-100/50 rounded-lg px-2.5 py-1">
                                        Dropdown selection: {step.options[0]}... (+ {step.options.length - 1} choices)
                                      </div>
                                    </div>
                                  )}

                                  {step.type === 'MULTIPLE_CHOICE' && step.options && step.options.length > 0 && (
                                    <div className="mt-1.5 flex gap-1.5 flex-wrap">
                                      {step.options.map((opt, oIdx) => (
                                        <span key={oIdx} className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-600 block shadow-3xs uppercase tracking-wider">
                                          {opt}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No checklist steps configured for this SOP template.</p>
                        )}
                      </div>

                      {/* Apply indicator bar */}
                      <div className="pt-3 border-t border-slate-250 mt-auto flex items-center justify-between">
                        <span className="text-[9.5px] text-slate-450 font-black uppercase tracking-wider font-mono">
                          Simul status: {isApplied ? (
                            <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg ml-1 select-none">Applied</span>
                          ) : (
                            <span className="text-slate-400 font-bold ml-1">Ready</span>
                          )}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleProcedure(previewProc.id)}
                            className={`text-xs font-black flex items-center gap-1.5 px-4 py-2 rounded-xl transition ${
                              isApplied
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-sm'
                                : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-sm'
                            }`}
                          >
                            {isApplied ? 'Remove from WO' : 'Apply to This WO'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Labor & costs */}
      <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm space-y-4 bg-white">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight pb-3 border-b border-indigo-50/50">Labor & costs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {inputRow('Labor hours', false,
            <input type="number" min="0" step="0.5" value={form.laborHours} onChange={e => set('laborHours', e.target.value)} className="input-field text-xs bg-white" placeholder="0" />
          )}
          {inputRow('Labor cost ($)', false,
            <input type="number" min="0" step="0.01" value={form.laborCost} onChange={e => set('laborCost', e.target.value)} className="input-field text-xs bg-white" placeholder="0.00" />
          )}
          {inputRow('Parts cost ($)', false,
            <input type="number" min="0" step="0.01" value={form.partsCost} onChange={e => set('partsCost', e.target.value)} className="input-field text-xs bg-white" placeholder="0.00" />
          )}
        </div>
        {inputRow('Technician notes', false,
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            className="input-field text-xs sm:text-sm resize-none" rows={3} placeholder="Any notes about the work performed..." />
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary text-xs font-bold py-2.5 px-5 shadow-sm shadow-blue-50">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create work order'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary text-xs font-bold py-2.5 px-5 border-slate-205/65 transition hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  )
}
