'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Star } from 'lucide-react'
import WorkOrderIssueSelector, { OTHER_ISSUE } from './WorkOrderIssueSelector'
import AssetTreeSelect from './AssetTreeSelect'
import LocationSelect from './LocationSelect'

interface Asset { id: string; name: string; assetCode: string | null; imageUrl?: string | null; categoryId?: string | null; parentId?: string | null; locationId?: string | null }
interface Location { id: string; name: string; address: string | null; path: string | null; parentId: string | null }
interface User  { id: string; name: string; role: string }
interface Team  { id: string; name: string; trade: string }
interface DomainGroup { id: string; name: string; issues: { id: string; code: string; title: string; severity?: string }[]; isFallback?: boolean }
interface Template {
  id: string; name: string; description?: string | null; items?: { id: string }[]
  locations?: { id: string }[]
  categories?: { id: string }[]
  assets?: { id: string }[]
}

interface WOFormData {
  title: string; description: string; type: string; priority: string
  status: string; dueDate: string; assetId: string; locationId: string; locationScope: string
  selectedAssetIds: string[]
  assignedToId: string; assignedTeamId: string; laborHours: string; laborCost: string; partsCost: string
  notes: string; issueId: string; customIssue: string; checklistTemplateIds: string[]
}

interface Props {
  assets: Asset[]; locations: Location[]; users: User[]; teams: Team[]
  templates?: Template[]
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

export default function WorkOrderForm({ assets, locations, users, teams, templates = [], initialData, woId, preselectedAssetId }: Props) {
  const router = useRouter()
  const isEdit = !!woId

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
    assignedTeamId: initialData?.assignedTeamId ?? '',
    laborHours:     initialData?.laborHours     ?? '',
    laborCost:      initialData?.laborCost      ?? '',
    partsCost:      initialData?.partsCost      ?? '',
    notes:          initialData?.notes          ?? '',
    issueId:        initialData?.customIssue    ? OTHER_ISSUE : (initialData?.issueId ?? ''),
    customIssue:    initialData?.customIssue    ?? '',
    checklistTemplateIds: [],
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [isTitleDirty, setIsTitleDirty] = useState(isEdit ? true : false)

  const [targetType, setTargetType] = useState<'ASSET' | 'LOCATION'>(
    (initialData?.locationId && !initialData?.assetId && !preselectedAssetId) ? 'LOCATION' : 'ASSET'
  )

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
    setForm(prev => ({ ...prev, [field]: value }))
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

    for (const t of templates) {
      const matchesAsset    = allAssetIdsForRec.some(aid => t.assets?.some(a => a.id === aid))
      const matchesCategory = categoryIds.size > 0 && [...categoryIds].some(cid => t.categories?.some(c => c.id === cid))
      const matchesLocation = form.locationId && t.locations?.some(l => l.id === form.locationId)
      if (matchesAsset || matchesCategory || matchesLocation) ids.add(t.id)
    }
    return ids
  }, [primaryAssetId, allSelectedAssetIds, form.locationId, templates, assets])

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aRec = recommendedIds.has(a.id) ? 0 : 1
      const bRec = recommendedIds.has(b.id) ? 0 : 1
      return aRec - bRec
    })
  }, [templates, recommendedIds])

  const hasRecommendations = recommendedIds.size > 0 && (!!primaryAssetId || !!form.locationId)

  function toggleTemplate(id: string) {
    setForm(prev => ({
      ...prev,
      checklistTemplateIds: prev.checklistTemplateIds.includes(id)
        ? prev.checklistTemplateIds.filter(t => t !== id)
        : [...prev.checklistTemplateIds, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      if (!form.title.trim()) { setError('Title is required'); setSaving(false); return }
      if (form.assignedTeamId && form.assignedToId) { setError('Assign to either a team or an individual, not both'); setSaving(false); return }

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
        assignedToId: form.assignedTeamId ? null : (form.assignedToId || null),
        teamId:       form.assignedTeamId || null,
        laborHours:   form.laborHours     ? parseFloat(form.laborHours)  : null,
        laborCost:    form.laborCost      ? parseFloat(form.laborCost)   : null,
        partsCost:    form.partsCost      ? parseFloat(form.partsCost)   : null,
        notes:        form.notes          || null,
        issueId:      form.issueId === OTHER_ISSUE ? null : (form.issueId || null),
        customIssue:  form.issueId === OTHER_ISSUE ? (form.customIssue || null) : null,
        checklistTemplateIds: form.checklistTemplateIds,
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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Core info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Work order details</h2>
        {inputRow('Title', true,
          <div className="space-y-2">
            <input
              type="text"
              value={form.title}
              onChange={e => { setIsTitleDirty(true); set('title', e.target.value) }}
              placeholder={suggestedTitle || 'Enter work order title...'}
              className="input-field"
            />
            {suggestedTitle && !form.title && (
              <p className="text-xs text-gray-500">
                💡 Suggested: <button type="button" onClick={() => set('title', suggestedTitle)} className="text-blue-600 hover:underline">{suggestedTitle}</button>
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {inputRow('Type', false,
            <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field">
              {typeOptions.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
            </select>
          )}
          {inputRow('Priority', false,
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input-field">
              {priorityOptions.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
            </select>
          )}
          {isEdit && inputRow('Status', false,
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
              {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
          )}
          {inputRow('Due date', false,
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className="input-field" />
          )}
        </div>
        {inputRow('Description', false,
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input-field resize-none" rows={3} placeholder="Describe the work to be done..." />
        )}
      </div>

      {/* Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Work location & scope</h2>
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => handleToggleTarget('ASSET')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                targetType === 'ASSET'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Asset
            </button>
            <button
              type="button"
              onClick={() => handleToggleTarget('LOCATION')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                targetType === 'LOCATION'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Location
            </button>
          </div>
        </div>

        {targetType === 'ASSET' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {assetMode === 'single' ? 'Asset' : 'Assets'}
              </label>
              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => { setAssetMode('single'); setForm(prev => ({ ...prev, selectedAssetIds: [] })) }}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all ${
                    assetMode === 'single'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => { setAssetMode('multi'); setForm(prev => ({ ...prev, assetId: '' })) }}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all ${
                    assetMode === 'multi'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select specific assets (optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Leave empty to apply to all location assets with scope selection below</p>
                  <AssetTreeSelect
                    assets={assets.filter(a => a.locationId === form.locationId || assets.filter(x => x.locationId === form.locationId).some(parent => a.parentId === parent.id))}
                    value={form.selectedAssetIds}
                    onChange={ids => set('selectedAssetIds', ids)}
                    multiSelect={true}
                    placeholder="Select assets..."
                  />
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-600">Scope of work</p>
                  <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="locationScope"
                      value="ALL_ASSETS"
                      checked={form.locationScope === 'ALL_ASSETS'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">All Assets in this Location</p>
                      <p className="text-xs text-gray-500">Creates a checklist for each asset recursively</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="locationScope"
                      value="GENERAL"
                      checked={form.locationScope === 'GENERAL'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">General Maintenance</p>
                      <p className="text-xs text-gray-500">Location-only ticket (no asset checklist)</p>
                    </div>
                  </label>
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {selectedAsset?.imageUrl && assetMode === 'single' && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-2">Asset photo</p>
            <div className="relative w-full max-w-xs aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-600">Assign work to:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputRow('Team', false,
              <select value={form.assignedTeamId} onChange={e => { set('assignedTeamId', e.target.value); if (e.target.value) set('assignedToId', '') }} className="input-field">
                <option value="">— No team —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trade})</option>)}
              </select>
            )}
            {inputRow('Individual', false,
              <select value={form.assignedToId} onChange={e => { set('assignedToId', e.target.value); if (e.target.value) set('assignedTeamId', '') }} className="input-field">
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Issue selector — shown when an asset or location is selected */}
      {(primaryAssetId && selectedAsset) || form.locationId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Issue</h2>
            {loadingIssues && <span className="text-xs text-gray-400 animate-pulse">Loading issues…</span>}
          </div>

          {issueGroups[0]?.isFallback ? (
            // Fallback — location WO, no category, no domains, or domains have no active issues
            <>
              <div className="flex items-center gap-2 mb-2">
                {!form.assetId && form.locationId ? (
                  <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-medium">Showing general/location issues</span>
                ) : (
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">Using common issues — no category-specific issues configured for this asset</span>
                )}
              </div>
              <WorkOrderIssueSelector
                groups={issueGroups}
                value={form.issueId}
                onChange={id => set('issueId', id)}
              />
              {form.issueId === OTHER_ISSUE && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={form.customIssue}
                    onChange={e => set('customIssue', e.target.value)}
                    placeholder="Describe the issue..."
                    className="input-field"
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
                <div className="mt-3">
                  <input
                    type="text"
                    value={form.customIssue}
                    onChange={e => set('customIssue', e.target.value)}
                    placeholder="Describe the issue..."
                    className="input-field"
                    autoFocus
                  />
                </div>
              )}
            </>
          ) : !loadingIssues ? (
            // Fetched but both domains and global issues are absent
            <>
              <p className="text-sm text-gray-400 mb-2">
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
                className="input-field"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Checklist Templates */}
      {templates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Checklist templates</h2>
          </div>
          <p className="text-xs text-gray-400">
            Select one or more checklists to snap into this work order. Changes to templates after creation will not affect existing work orders.
          </p>

          {hasRecommendations && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                Recommended
              </div>
              {sortedTemplates.filter(t => recommendedIds.has(t.id)).map(template => (
                <label key={template.id} className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50/50 rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={form.checklistTemplateIds.includes(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{template.name}</p>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full">
                        <Star className="w-2.5 h-2.5 fill-emerald-500" />
                        Recommended
                      </span>
                    </div>
                    {template.description && <p className="text-xs text-gray-500">{template.description}</p>}
                    {template.items && template.items.length > 0 && <p className="text-xs text-gray-400 mt-1">{template.items.length} items</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {hasRecommendations && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">
                All templates
              </div>
            )}
            {sortedTemplates.filter(t => !recommendedIds.has(t.id)).map(template => (
              <label key={template.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={form.checklistTemplateIds.includes(template.id)}
                  onChange={() => toggleTemplate(template.id)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{template.name}</p>
                  {template.description && <p className="text-xs text-gray-500">{template.description}</p>}
                  {template.items && template.items.length > 0 && <p className="text-xs text-gray-400 mt-1">{template.items.length} items</p>}
                </div>
              </label>
            ))}
          </div>

          {form.checklistTemplateIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
              <ClipboardCheck className="w-3.5 h-3.5" />
              {form.checklistTemplateIds.length} template{form.checklistTemplateIds.length !== 1 ? 's' : ''} will be snapshotted into this work order
            </div>
          )}
        </div>
      )}

      {/* Labor & costs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Labor & costs</h2>
        <div className="grid grid-cols-3 gap-4">
          {inputRow('Labor hours', false,
            <input type="number" min="0" step="0.5" value={form.laborHours} onChange={e => set('laborHours', e.target.value)} className="input-field" placeholder="0" />
          )}
          {inputRow('Labor cost ($)', false,
            <input type="number" min="0" step="0.01" value={form.laborCost} onChange={e => set('laborCost', e.target.value)} className="input-field" placeholder="0.00" />
          )}
          {inputRow('Parts cost ($)', false,
            <input type="number" min="0" step="0.01" value={form.partsCost} onChange={e => set('partsCost', e.target.value)} className="input-field" placeholder="0.00" />
          )}
        </div>
        {inputRow('Technician notes', false,
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            className="input-field resize-none" rows={3} placeholder="Any notes about the work performed..." />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create work order'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
