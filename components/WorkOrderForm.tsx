'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { OTHER_ISSUE } from './WorkOrderIssueSelector'
import AssetTreeSelect from './AssetTreeSelect'
import LocationSelect from './LocationSelect'
import CustomFieldsPanel from './CustomFieldsPanel'
import { WO_STATUS_LABELS, WO_STATUS_PILL } from '@/lib/work-order-status'

interface Asset { id: string; name: string; assetCode: string | null; imageUrl?: string | null; categoryId?: string | null; parentId?: string | null; locationId?: string | null }
interface Location { id: string; name: string; address: string | null; path: string | null; parentId: string | null }
interface User  { id: string; name: string; role: string }
interface DomainGroup { id: string; name: string; issues: { id: string; code: string; title: string; severity?: string }[]; isFallback?: boolean; recommended?: boolean }

interface WOFormData {
  title: string; description: string; type: string; priority: string
  status: string; startDate: string; startTime: string; dueDate: string; dueTime: string
  assetId: string; locationId: string; locationScope: string
  selectedAssetIds: string[]
  failedComponentId: string
  assignedToId: string; teamId: string; laborHours: string; laborCost: string; partsCost: string
  notes: string; issueId: string; customIssue: string; domainId: string;
  customFields: Record<string, any> | null
  woCategoryId: string
  downtimeStartedAt: string
}

interface Meta {
  woNumber?: string
  status?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

interface Props {
  assets: Asset[]; locations: Location[]; users: User[]; teams: { id: string; name: string }[]
  initialData?: Partial<WOFormData>
  woId?: string
  preselectedAssetId?: string
  preselectedLocationId?: string
  meta?: Meta
}

const typeOptions     = ['BREAKDOWN','PREVENTIVE','PREDICTIVE']
const priorityOptions = ['LOW','MEDIUM','HIGH','CRITICAL']
const statusOptions   = Object.keys(WO_STATUS_LABELS).filter(s => !['PENDING_APPROVAL','CLOSED'].includes(s))
const typeLabels: Record<string,string>     = { BREAKDOWN:'Breakdown', PREVENTIVE:'Preventive', PREDICTIVE:'Predictive' }
const priorityLabels: Record<string,string> = { LOW:'Low', MEDIUM:'Medium', HIGH:'High', CRITICAL:'Critical' }
const statusLabels = WO_STATUS_LABELS

function selectionKey(f: WOFormData): string {
  return `${f.assetId}|${f.selectedAssetIds.join(',')}|${f.type}|${f.issueId}|${f.customIssue}`
}

export default function WorkOrderForm({ assets, locations, users, teams = [], initialData, woId, preselectedAssetId, preselectedLocationId, meta }: Props) {
  const router = useRouter()
  const isEdit = !!woId

  const buildInitialForm = () => ({
    title:          initialData?.title          ?? '',
    description:    initialData?.description    ?? '',
    type:           initialData?.type           ?? 'BREAKDOWN',
    priority:       initialData?.priority       ?? 'MEDIUM',
    status:         initialData?.status         ?? 'OPEN',
    startDate:      initialData?.startDate      ?? '',
    startTime:      initialData?.startTime      ?? '',
    dueDate:        initialData?.dueDate        ?? '',
    dueTime:        initialData?.dueTime        ?? '',
    assetId:        initialData?.assetId        ?? preselectedAssetId ?? '',
    locationId:     initialData?.locationId     ?? preselectedLocationId ?? '',
    locationScope:  initialData?.locationScope  ?? 'GENERAL',
    selectedAssetIds: initialData?.selectedAssetIds ?? [],
    failedComponentId: initialData?.failedComponentId ?? '',
    assignedToId:   initialData?.assignedToId   ?? '',
    teamId:         initialData?.teamId         ?? '',
    laborHours:     initialData?.laborHours     ?? '',
    laborCost:      initialData?.laborCost      ?? '',
    partsCost:      initialData?.partsCost      ?? '',
    notes:          initialData?.notes          ?? '',
    issueId:        initialData?.customIssue    ? OTHER_ISSUE : (initialData?.issueId ?? ''),
    customIssue:    initialData?.customIssue    ?? '',
    domainId:       initialData?.domainId       ?? '',
    customFields:   (initialData as any)?.customFields ?? null,
    woCategoryId:   (initialData as any)?.woCategoryId ?? '',
    downtimeStartedAt: (initialData as any)?.downtimeStartedAt
      ? toLocalInput((initialData as any).downtimeStartedAt)
      : '',
  })

  const [initialForm] = useState<WOFormData>(buildInitialForm)
  const [form, setForm] = useState<WOFormData>(initialForm)

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const lastSelectionKeyRef = useRef(selectionKey(initialForm))

  const [targetType, setTargetType] = useState<'ASSET' | 'LOCATION'>(
    preselectedLocationId
      ? 'LOCATION'
      : initialData?.locationScope
        ? 'LOCATION'
        : 'ASSET'
  )

  // ── Unsaved-changes guard ──────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (href && href.startsWith('/') && !href.startsWith('/api/')) {
        if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
          e.preventDefault()
        }
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [isDirty])

  function handleCancel() {
    if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to leave?')) return
    if (isEdit && woId) router.push(`/work-orders/${woId}`)
    else router.back()
  }

  const handleToggleTarget = (type: 'ASSET' | 'LOCATION') => {
    setTargetType(type)
    if (type === 'ASSET') {
      setForm(prev => ({ ...prev, locationId: '', locationScope: 'GENERAL', selectedAssetIds: [] }))
    } else {
      setForm(prev => ({ ...prev, assetId: '', issueId: '', customIssue: '', domainId: '', failedComponentId: '' }))
    }
  }

  // ── Issue groups fetched dynamically when asset or location changes ──
  const [issueGroups, setIssueGroups] = useState<DomainGroup[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)

  // ── Work order categories (admin-defined) ──
  const [woCategories, setWOCategories] = useState<{ id: string; name: string; isActive: boolean }[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/wo-categories')
      .then(r => r.json())
      .then((data: { id: string; name: string; isActive: boolean }[]) => { if (active) setWOCategories(data) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // ── Smart recommendations from the primary asset ──
  const [recommendation, setRecommendation] = useState<{
    team: { id: string; name: string } | null
    teams: { id: string; name: string }[]
    owner: { id: string; name: string } | null
    criticality: string | null
  } | null>(null)
  const lastAutoPriority = useRef<string | null>(null)

  const allSelectedAssetIds = [...new Set([
    ...(form.assetId ? [form.assetId] : []),
    ...form.selectedAssetIds,
  ])]
  const primaryAssetId = form.assetId || form.selectedAssetIds[0] || ''
  const selectedAsset = assets.find(a => a.id === primaryAssetId)

  useEffect(() => {
    if (!primaryAssetId && !form.locationId) { setIssueGroups([]); return }
    setLoadingIssues(true)
    const url = primaryAssetId
      ? `/api/issues?assetId=${encodeURIComponent(primaryAssetId)}`
      : `/api/issues?categoryId=${selectedAsset?.categoryId ?? ''}`
    fetch(url)
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

  useEffect(() => {
    if (!primaryAssetId) { setRecommendation(null); return }
    let active = true
    fetch(`/api/recommendations?assetId=${encodeURIComponent(primaryAssetId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((rec: { team: { id: string; name: string } | null; teams: { id: string; name: string }[]; owner: { id: string; name: string } | null; criticality: string | null } | null) => { if (active) setRecommendation(rec) })
      .catch(() => {})
    return () => { active = false }
  }, [primaryAssetId])

  const recommendedTeams = recommendation?.teams?.length
    ? recommendation.teams
    : (recommendation?.team ? [recommendation.team] : [])
  const recommendedTeamIds = new Set(recommendedTeams.map(t => t.id))
  const otherTeams = teams.filter(t => !recommendedTeamIds.has(t.id))

  function set(field: keyof WOFormData, value: string | string[] | Record<string, any> | null) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      return next
    })
  }

  const selectableGroups = issueGroups.filter(g => (g.issues?.length ?? 0) > 0)
  const selectedGroup = selectableGroups.find(g => g.id === form.domainId)
  // Keep an existing (e.g. team-derived or previously saved) domain selectable even when it has no issues in the current asset scope.
  const domainOptions = (() => {
    const options = [...selectableGroups]
    if (form.domainId && !options.some(g => g.id === form.domainId)) {
      options.unshift({ id: form.domainId, name: 'Current domain', issues: [], isFallback: false })
    }
    return options
  })()
  const selectedGroupIssues = selectedGroup?.issues ?? []

  function handleDomainChange(groupId: string) {
    setForm(prev => {
      const next = { ...prev, domainId: groupId, issueId: '', customIssue: '' }
      const group = selectableGroups.find(g => g.id === groupId)
      if (group?.issues?.length) {
        next.issueId = group.issues[0].id
        if (group.issues[0].severity) {
          next.priority = group.issues[0].severity
          lastAutoPriority.current = group.issues[0].severity
        }
      }
      return next
    })
  }

  function handleIssueChange(id: string) {
    const issue = issueGroups.flatMap(g => g.issues).find(i => i.id === id)
    setForm(prev => {
      const next = { ...prev, issueId: id }
      if (id !== OTHER_ISSUE) next.customIssue = ''
      if (issue?.severity && (prev.priority === lastAutoPriority.current || !lastAutoPriority.current)) {
        next.priority = issue.severity
        lastAutoPriority.current = issue.severity
      }
      return next
    })
  }

  function handlePriorityChange(value: string) {
    lastAutoPriority.current = null
    set('priority', value)
  }

  function generateTitle(assetIds: string[], selectedAssetIds: string[], type: string, issueId: string, customIssue: string): string {
    const allIds = [...new Set([...assetIds.filter(Boolean), ...selectedAssetIds])]
    if (allIds.length === 0) {
      const suffix = issueId === OTHER_ISSUE && customIssue.trim()
        ? customIssue.trim()
        : issueId && issueId !== OTHER_ISSUE
          ? issueGroups.flatMap(g => g.issues).find(i => i.id === issueId)?.title ?? null
          : null
      return suffix || typeLabels[type] || ''
    }

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
    if (isEdit) return
    const newTitle = generateTitle(form.assetId ? [form.assetId] : [], form.selectedAssetIds, form.type, form.issueId, form.customIssue)
    if (newTitle && newTitle !== form.title) setForm(prev => ({ ...prev, title: newTitle }))
  }, [primaryAssetId, form.type, form.issueId, form.customIssue, issueGroups, form.selectedAssetIds, isEdit])

  useEffect(() => {
    if (!isEdit) return
    const key = selectionKey(form)
    if (key === lastSelectionKeyRef.current) return
    lastSelectionKeyRef.current = key
    const newTitle = generateTitle(form.assetId ? [form.assetId] : [], form.selectedAssetIds, form.type, form.issueId, form.customIssue)
    if (newTitle && newTitle !== form.title) setForm(prev => ({ ...prev, title: newTitle }))
  }, [isEdit, form.assetId, form.type, form.issueId, form.customIssue, form.selectedAssetIds, issueGroups, form.title])

  const suggestedTitle = generateTitle(form.assetId ? [form.assetId] : [], form.selectedAssetIds, form.type, form.issueId, form.customIssue)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      if (!form.title.trim()) { setError('Title is required'); setSaving(false); return }
      if (form.teamId && form.assignedToId) { setError('Assign to either a team or an individual, not both'); setSaving(false); return }
      if (!isEdit) {
        if (!form.assetId && form.selectedAssetIds.length === 0 && !form.locationId) {
          setError('Select an asset or location for the work order')
          setSaving(false)
          return
        }
        if (selectableGroups.length > 0 && !form.domainId) {
          setError('Please select a domain / nature for the work order')
          setSaving(false)
          return
        }
        if (selectableGroups.length > 0 && !form.issueId) {
          setError('Please select an issue for the work order')
          setSaving(false)
          return
        }
        if (form.issueId === OTHER_ISSUE && !form.customIssue.trim()) {
          setError('Please describe the issue')
          setSaving(false)
          return
        }
      }

      if (form.startDate && form.dueDate) {
        const startDt = form.startDate + (form.startTime ? 'T' + form.startTime : 'T00:00')
        const dueDt   = form.dueDate   + (form.dueTime   ? 'T' + form.dueTime   : 'T12:00')
        if (new Date(dueDt).getTime() < new Date(startDt).getTime()) {
          setError('Due date cannot be before start date')
          setSaving(false)
          return
        }
      }

      const detailUrl = isEdit && woId ? `/work-orders/${woId}` : '/work-orders'
      if (!isDirty) {
        router.push(detailUrl)
        router.refresh()
        return
      }

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
        startDate:    form.startDate ? (form.startDate + (form.startTime ? 'T' + form.startTime : 'T00:00')) : null,
        dueDate:      form.dueDate ? (form.dueDate + (form.dueTime ? 'T' + form.dueTime : 'T12:00')) : null,
        assetId:      form.assetId        || null,
        failedComponentId: form.failedComponentId || null,
        locationId:   form.locationId     || null,
        locationScope: form.locationId && form.selectedAssetIds.length === 0 ? form.locationScope : null,
        selectedAssetIds: uniqueAssetIds,
        assignedToId: form.teamId ? null : (form.assignedToId || null),
        teamId:       form.teamId || null,
        laborHours:   form.laborHours     ? parseFloat(form.laborHours)  : null,
        laborCost:    form.laborCost      ? parseFloat(form.laborCost)   : null,
        partsCost:    form.partsCost      ? parseFloat(form.partsCost)   : null,
        notes:        form.notes          || null,
        issueId:      form.issueId === OTHER_ISSUE ? null : (form.issueId || null),
        customIssue:  form.issueId === OTHER_ISSUE ? (form.customIssue || null) : null,
        domainId:     form.domainId && !selectedGroup?.isFallback ? form.domainId : null,
        customFields: form.customFields,
        woCategoryId: form.woCategoryId || null,
        downtimeStartedAt: form.type === 'BREAKDOWN' && form.downtimeStartedAt
          ? new Date(form.downtimeStartedAt).toISOString()
          : null,
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

  const toLocalInput = (v: string | Date) => {
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const inputRow = (label: string, required = false, children: React.ReactNode) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const fmtDate = (d?: string | Date) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-7 max-w-3xl">
      {error && (
        <div className="bg-rose-50 border border-rose-105 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold shadow-xs">{error}</div>
      )}

      {isEdit && meta && (
        <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500 bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5">
          <span className="font-bold text-slate-700">Editing</span>
          {meta.woNumber && <span className="font-mono font-semibold text-slate-600">{meta.woNumber}</span>}
          {meta.status && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${WO_STATUS_PILL[meta.status] || 'bg-slate-100 text-slate-600'}`}>
              {statusLabels[meta.status] || meta.status}
            </span>
          )}
          {fmtDate(meta.createdAt) && <span className="hidden sm:inline">Created {fmtDate(meta.createdAt)}</span>}
          {fmtDate(meta.updatedAt) && <span className="hidden sm:inline">Updated {fmtDate(meta.updatedAt)}</span>}
        </div>
      )}

      {/* Core info */}
      <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm space-y-5 bg-white">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight pb-3 border-b border-slate-100">Work order details</h2>
        {inputRow('Title', true,
          <div className="space-y-2">
            <input
              type="text"
              value={form.title}
              readOnly
              placeholder={suggestedTitle || 'Enter work order title...'}
              className="input-field text-xs sm:text-sm bg-gray-50"
            />
            <p className="text-[11px] text-slate-400 font-medium">Auto-generated from your selections.</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inputRow('Type', false,
            <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field text-xs sm:text-sm bg-white">
              {typeOptions.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
            </select>
          )}
          {inputRow('Priority', false,
            <>
              <select value={form.priority} onChange={e => handlePriorityChange(e.target.value)} className="input-field text-xs sm:text-sm bg-white">
                {priorityOptions.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </select>
              {lastAutoPriority.current && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">Auto-set from issue severity</p>
              )}
            </>
          )}
          {inputRow('Category', false,
            <select value={form.woCategoryId} onChange={e => set('woCategoryId', e.target.value)} className="input-field text-xs sm:text-sm bg-white">
              <option value="">None</option>
              {woCategories.filter(c => c.isActive || c.id === form.woCategoryId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {isEdit && inputRow('Status', false,
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field text-xs sm:text-sm bg-white">
              {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inputRow('Start date', false,
            <div className="flex gap-2">
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                className="input-field text-xs sm:text-sm bg-white cursor-pointer flex-1" />
              <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)}
                className="input-field text-xs sm:text-sm bg-white cursor-pointer w-28!" />
            </div>
          )}
          {inputRow('Due date', false,
            <div className="flex gap-2">
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                className="input-field text-xs sm:text-sm bg-white cursor-pointer flex-1" />
              <input type="time" value={form.dueTime} onChange={e => set('dueTime', e.target.value)}
                className="input-field text-xs sm:text-sm bg-white cursor-pointer w-28!" />
            </div>
          )}
        </div>
        {form.type === 'BREAKDOWN' && inputRow('Machine down since', false,
          <>
            <input
              type="datetime-local"
              value={form.downtimeStartedAt}
              onChange={e => set('downtimeStartedAt', e.target.value)}
              className="input-field text-xs sm:text-sm bg-white cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              When the machine actually went down. If unknown, leave blank — the tech can record it when work starts.
            </p>
          </>
        )}
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
          <>
            <div>
              <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-3">Asset</label>
              <AssetTreeSelect
                assets={assets}
                value={form.assetId || form.selectedAssetIds[0] || ''}
                onChange={id => { set('assetId', id); set('selectedAssetIds', []); set('failedComponentId', '') }}
                placeholder="Select an asset..."
              />
            </div>
            {primaryAssetId && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">
                  Failed component <span className="text-slate-400 font-semibold normal-case">(optional)</span>
                </label>
                <AssetTreeSelect
                  assets={assets}
                  subtreeId={primaryAssetId}
                  value={form.failedComponentId}
                  onChange={id => set('failedComponentId', id as string)}
                  placeholder="Select a failed component..."
                />
                <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                  The component within {selectedAsset?.name ?? 'the asset'} where the failure occurred. Only its sub-assets are shown.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">
                Location
              </label>
              <LocationSelect
                locations={locations}
                value={form.locationId}
                onChange={id => {
                  if (id !== form.locationId) {
                    set('locationId', id)
                    set('selectedAssetIds', [])
                  }
                }}
              />
              <p className="text-[11px] text-slate-400 mt-1.5 font-medium">A location work order is a single ticket for this location.</p>
            </div>
          </div>
        )}

        {selectedAsset?.imageUrl && (
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
            {inputRow('Team', false,
              <select value={form.teamId} onChange={e => { set('teamId', e.target.value); if (e.target.value) set('assignedToId', '') }} className="input-field text-xs sm:text-sm bg-white cursor-pointer">
                <option value="">— No team —</option>
                {recommendedTeams.length > 0 && (
                  <optgroup label="⭐ Recommended">
                    {recommendedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                )}
                {otherTeams.length > 0 && (
                  <optgroup label="All teams">
                    {otherTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                )}
              </select>
            )}
            {inputRow('Individual', false,
              <select value={form.assignedToId} onChange={e => { set('assignedToId', e.target.value); if (e.target.value) set('teamId', '') }} className="input-field text-xs sm:text-sm bg-white cursor-pointer">
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

          {issueGroups.length > 0 ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Domain / Nature</label>
                <select
                  value={form.domainId}
                  onChange={e => handleDomainChange(e.target.value)}
                  className="input-field text-xs sm:text-sm bg-white"
                  disabled={loadingIssues}
                >
                  <option value="">Select the domain</option>
                  {domainOptions.map(g => (
                    <option key={g.id} value={g.id}>{g.isFallback ? 'Common Issues' : g.name}</option>
                  ))}
                </select>
              </div>

              {form.domainId && selectedGroup && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Issue</label>
                    <select
                      value={form.issueId}
                      onChange={e => handleIssueChange(e.target.value)}
                      className="input-field text-xs sm:text-sm bg-white"
                    >
                      <option value="">Select the issue</option>
                      {selectedGroupIssues.map(i => (
                        <option key={i.id} value={i.id}>{i.title} ({i.code})</option>
                      ))}
                      <option value={OTHER_ISSUE}>Other (type manually)</option>
                    </select>
                  </div>

                  {form.issueId === OTHER_ISSUE && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Describe the issue</label>
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
              )}
            </>
          ) : !loadingIssues ? (
            <>
              <p className="text-xs text-slate-400 font-medium mb-3">
                No issues configured. Describe the problem below.
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

      {/* Smart suggestions from the primary asset */}
      {recommendation && (recommendation.owner || (recommendation.criticality && !form.issueId)) ? (
        <div className="premium-card p-5 border border-slate-200/50 shadow-sm space-y-3 bg-white">
          <h2 className="font-bold text-slate-805 text-sm tracking-tight">Suggestions</h2>
          <div className="flex flex-wrap gap-2">
            {recommendation.owner && recommendation.owner.id !== form.assignedToId && (
              <button
                type="button"
                onClick={() => { set('assignedToId', recommendation.owner!.id); set('teamId', '') }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/70 rounded-lg px-2.5 py-1.5 hover:bg-blue-100/70 transition"
              >
                🧑‍🔧 Owner: {recommendation.owner.name} — <span className="underline underline-offset-2">Assign</span>
              </button>
            )}
            {recommendation.criticality && !form.issueId && form.priority !== recommendation.criticality && (
              <button
                type="button"
                onClick={() => { lastAutoPriority.current = null; set('priority', recommendation.criticality) }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-lg px-2.5 py-1.5 hover:bg-amber-100/70 transition"
              >
                ⚠️ Asset is {recommendation.criticality.toLowerCase()} priority — <span className="underline underline-offset-2">Apply</span>
              </button>
            )}
          </div>
        </div>
      ) : null}
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

      {/* Custom Fields */}
      <div className="premium-card p-5 sm:p-6 border border-slate-200/50 shadow-sm space-y-4 bg-white">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight pb-3 border-b border-indigo-50/50">Custom fields</h2>
        <CustomFieldsPanel
          fields={form.customFields}
          onChange={fields => set('customFields', fields)}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary text-xs font-bold py-2.5 px-5 shadow-sm shadow-blue-50">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create work order'}
        </button>
        <button type="button" onClick={handleCancel} className="btn-secondary text-xs font-bold py-2.5 px-5 border-slate-205/65 transition hover:bg-slate-50">Cancel</button>
      </div>
    </form>
  )
}
