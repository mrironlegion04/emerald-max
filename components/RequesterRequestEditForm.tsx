'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import RequestAssetPicker from '@/components/RequestAssetPicker'

const OTHER_ISSUE = '__other__'

interface PickedAsset {
  id: string
  name: string
  location?: { id?: string | null; name?: string | null; path?: string | null } | null
}

interface DomainGroup {
  id: string
  name: string
  isFallback?: boolean
  recommended?: boolean
  issues: { id: string; code: string; title: string; severity?: string }[]
}

interface Props {
  woId: string
  initial: {
    title: string
    description: string | null
    priority: string
    dueDate: string | null
    teamId: string | null
    assetId: string | null
    assetName: string | null
    assetLocation: string | null
    issueId: string | null
    issueTitle: string | null
    issueCode: string | null
    customIssue: string | null
  }
}

export default function RequesterRequestEditForm({ woId, initial }: Props) {
  const router = useRouter()

  const [form, setForm] = useState({
    title: initial.title,
    description: initial.description ?? '',
    priority: initial.priority,
    desiredDate: initial.dueDate ?? '',
    assetId: initial.assetId ?? '',
    location: initial.assetLocation ?? '',
    issueId: initial.customIssue ? OTHER_ISSUE : (initial.issueId ?? ''),
    customIssue: initial.customIssue ?? '',
    teamId: initial.teamId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [issueGroups, setIssueGroups] = useState<DomainGroup[]>([])
  const [issuesLoading, setIssuesLoading] = useState(true)
  const [assignTeams, setAssignTeams] = useState<{ id: string; name: string }[]>([])

  const lastAutoPriority = useRef<string | null>(null)
  const assetNameRef = useRef(initial.assetName ?? '')

  function set(f: keyof typeof form, v: string) { setForm(p => ({ ...p, [f]: v })) }

  useEffect(() => {
    let active = true
    fetch('/api/teams')
      .then(r => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string }[]) => {
        if (active && Array.isArray(list)) setAssignTeams(list.map(t => ({ id: t.id, name: t.name })))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const url = form.assetId
      ? `/api/issues?scope=request&assetId=${encodeURIComponent(form.assetId)}`
      : '/api/issues?scope=request'
    fetch(url)
      .then(r => r.json())
      .then((groups: DomainGroup[]) => { if (active && Array.isArray(groups)) setIssueGroups(groups) })
      .catch(() => {})
      .finally(() => { if (active) setIssuesLoading(false) })
    return () => { active = false }
  }, [form.assetId])

  const activeGroup = issueGroups.find(g => (g.issues?.length ?? 0) > 0)
  const hasIssues = !!activeGroup
  const selectedGroupIssues = activeGroup?.issues ?? []

  // Ensure the WO's current issue stays selectable even if it is no longer
  // part of the fetched group (e.g. the asset category issues changed).
  const allIssues = issueGroups.flatMap(g => g.issues ?? [])
  const currentIssueMissing =
    !!initial.issueId &&
    !allIssues.some(i => i.id === initial.issueId)

  function domainLabel(group: { isFallback?: boolean; name: string }) {
    return group.isFallback ? 'Common Issues' : group.name
  }

  function buildSuggestedTitle(group: { isFallback?: boolean; name: string } | undefined, middle?: string) {
    const parts: string[] = []
    if (group) parts.push(domainLabel(group))
    if (middle) parts.push(middle)
    const locator = assetNameRef.current || form.location
    if (locator) parts.push(locator)
    return parts.join(' — ')
  }

  function handleIssueChange(id: string) {
    const issue = allIssues.find(i => i.id === id)
    const middle = id === OTHER_ISSUE ? 'Other' : (issue?.title ?? '')
    setForm(p => {
      const next = { ...p, issueId: id, customIssue: '' }
      if (issue?.severity && (p.priority === lastAutoPriority.current || !lastAutoPriority.current)) {
        next.priority = issue.severity
        lastAutoPriority.current = issue.severity
      }
      next.title = buildSuggestedTitle(activeGroup, middle)
      return next
    })
  }

  function handleCustomIssueChange(v: string) {
    setForm(p => {
      const next = { ...p, customIssue: v }
      next.title = buildSuggestedTitle(activeGroup, v ? `Other: ${v}` : 'Other')
      return next
    })
  }

  function handlePriorityChange(v: string) {
    lastAutoPriority.current = null
    set('priority', v)
  }

  function handleAssetChange(asset: PickedAsset | null) {
    const id = asset?.id ?? ''
    assetNameRef.current = asset?.name ?? ''
    setForm(p => {
      const next = { ...p, assetId: id, location: id ? (asset?.location?.path ?? asset?.location?.name ?? '') : '' }
      const issue = allIssues.find(i => i.id === p.issueId)
      const middle = p.issueId === OTHER_ISSUE ? (p.customIssue ? `Other: ${p.customIssue}` : 'Other') : (issue?.title ?? '')
      next.title = buildSuggestedTitle(activeGroup, middle)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    if (!form.assetId) {
      setError('Please select an asset for your request')
      setSaving(false)
      return
    }
    if (hasIssues && !form.issueId) {
      setError('Please select an issue for your request')
      setSaving(false)
      return
    }
    if (form.issueId === OTHER_ISSUE && !form.customIssue.trim()) {
      setError('Please describe your issue')
      setSaving(false)
      return
    }
    if (!form.teamId) {
      setError('Please select the maintenance team for this work order')
      setSaving(false)
      return
    }
    try {
      const payload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.desiredDate || null,
        assetId: form.assetId || null,
        issueId: form.issueId === OTHER_ISSUE ? null : (form.issueId || null),
        customIssue: form.issueId === OTHER_ISSUE ? form.customIssue.trim() : null,
        teamId: form.teamId,
      }
      const res = await fetch(`/api/work-orders/${woId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save changes'); return }
      router.push(`/my-work-orders/${woId}`)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Request title</label>
        <input type="text" value={form.title} readOnly className="input-field bg-gray-50" placeholder="Auto-generated from your selections" />
        <p className="text-[11px] text-gray-400 mt-1">Auto-generated from your selections.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input-field resize-none" rows={4} placeholder="Please describe the problem in detail..." required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Asset <span className="text-red-500">*</span></label>
        <RequestAssetPicker value={form.assetId} onChange={handleAssetChange} />
        <p className="text-[11px] text-gray-400 mt-1">Select the asset this request is about. Location auto-fills from it.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        {form.assetId ? (
          form.location ? (
            <div className="input-field bg-gray-50 text-gray-500 flex items-center gap-2">
              <span className="truncate">{form.location}</span>
            </div>
          ) : (
            <div className="input-field bg-gray-50 text-gray-400">This asset has no location assigned</div>
          )
        ) : (
          <div className="input-field bg-gray-50 text-gray-400">Select an asset to see its location</div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Issue <span className="text-red-500">*</span></label>
        {activeGroup && (
          <div className="mb-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
            {domainLabel(activeGroup)}
          </div>
        )}
        <select
          value={form.issueId}
          onChange={e => handleIssueChange(e.target.value)}
          className="input-field"
          disabled={issuesLoading}
        >
          <option value="">{issuesLoading ? 'Loading…' : hasIssues ? 'Select the issue' : 'No issues configured'}</option>
          {selectedGroupIssues.map(i => (
            <option key={i.id} value={i.id}>{i.title} ({i.code})</option>
          ))}
          {currentIssueMissing && initial.issueId && (
            <option key={initial.issueId} value={initial.issueId}>
              {initial.issueTitle ?? 'Current issue'}{initial.issueCode ? ` (${initial.issueCode})` : ''}
            </option>
          )}
          <option value={OTHER_ISSUE}>Other (type manually)</option>
        </select>
        {form.issueId === OTHER_ISSUE && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Describe the issue <span className="text-red-500">*</span></label>
            <textarea
              value={form.customIssue}
              onChange={e => handleCustomIssueChange(e.target.value)}
              className="input-field resize-none"
              rows={2}
              placeholder="e.g. Pump is vibrating badly"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select value={form.priority} onChange={e => handlePriorityChange(e.target.value)} className="input-field">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical — urgent!</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Desired completion date</label>
        <input type="date" value={form.desiredDate} onChange={e => set('desiredDate', e.target.value)} className="input-field" />
        <p className="text-[11px] text-gray-400 mt-1">Optional — when would you like this completed?</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance team <span className="text-red-500">*</span></label>
        <select value={form.teamId} onChange={e => set('teamId', e.target.value)} className="input-field">
          <option value="">Select the team</option>
          {assignTeams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary py-2.5 px-5">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary py-2.5 px-5">Cancel</button>
      </div>
    </form>
  )
}
