'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Settings, CheckCircle, X, ImagePlus } from 'lucide-react'
import RequestAssetPicker from '@/components/RequestAssetPicker'

interface CurrentUser {
  name: string
  email: string
  role: string
}

interface PickedAsset {
  id: string
  name: string
  location?: { id?: string | null; name?: string | null; path?: string | null } | null
}

interface AttachmentUpload {
  url: string
  originalName: string
  mimeType: string
  size: number
}

interface DomainGroup {
  id: string
  name: string
  isFallback?: boolean
  recommended?: boolean
  issues: { id: string; code: string; title: string; severity?: string }[]
}

const EMPTY_FORM = {
  title: '', description: '', location: '', locationId: '', requesterName: '', requesterEmail: '', requesterPhone: '',
  priority: 'MEDIUM', requestType: '', assetId: '', desiredDate: '', downtimeStartedAt: '',
  issueId: '', domainId: '', customIssue: '', teamId: '',
}

const OTHER_ISSUE = '__other__'

export default function PublicRequestForm({ currentUser, initialAssetId }: { currentUser: CurrentUser | null; initialAssetId?: string }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    requesterName: currentUser?.name ?? '',
    requesterEmail: currentUser?.email ?? '',
    assetId: initialAssetId ?? '',
  })
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [issueGroups, setIssueGroups] = useState<DomainGroup[]>([])
  const [issuesLoading, setIssuesLoading] = useState(true)

  const lastAutoPriority = useRef<string | null>(null)
  const assetNameRef = useRef('')
  const [assignTeams, setAssignTeams] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!currentUser) return
    let active = true
    fetch('/api/teams')
      .then(r => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string }[]) => {
        if (!active) return
        const teams = Array.isArray(list) ? list.map(t => ({ id: t.id, name: t.name })) : []
        setAssignTeams(teams)
        if (teams.length > 0) setForm(p => ({ ...p, teamId: p.teamId || teams[0].id }))
      })
      .catch(() => {})
    return () => { active = false }
  }, [currentUser])

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

  const hasIssues = issueGroups.some(g => (g.issues?.length ?? 0) > 0)
  const selectableGroups = issueGroups.filter(g => (g.issues?.length ?? 0) > 0)
  const selectedGroup = selectableGroups.find(g => g.id === form.domainId)
  const selectedGroupIssues = selectedGroup?.issues ?? []

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

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

  function handleDomainChange(groupId: string) {
    setForm(p => {
      const next = { ...p, domainId: groupId, issueId: '', customIssue: '' }
      const group = selectableGroups.find(g => g.id === groupId)
      if (group?.issues?.length) {
        next.issueId = group.issues[0].id
        if (group.issues[0].severity) {
          next.priority = group.issues[0].severity
          lastAutoPriority.current = group.issues[0].severity
        }
        if (!next.title) next.title = buildSuggestedTitle(group, group.issues[0].title)
      }
      return next
    })
  }

  function handleIssueChange(id: string) {
    const issue = issueGroups.flatMap(g => g.issues ?? []).find(i => i.id === id)
    const middle = id === OTHER_ISSUE ? 'Other' : (issue?.title ?? '')
    setForm(p => {
      const next = { ...p, issueId: id, customIssue: '' }
      if (issue?.severity && (p.priority === lastAutoPriority.current || !lastAutoPriority.current)) {
        next.priority = issue.severity
        lastAutoPriority.current = issue.severity
      }
      next.title = buildSuggestedTitle(selectedGroup, middle)
      return next
    })
  }

  function handleCustomIssueChange(v: string) {
    setForm(p => {
      const next = { ...p, customIssue: v }
      next.title = buildSuggestedTitle(selectedGroup, v ? `Other: ${v}` : 'Other')
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
      const issue = issueGroups.flatMap(g => g.issues ?? []).find(i => i.id === p.issueId)
      const middle = p.issueId === OTHER_ISSUE ? (p.customIssue ? `Other: ${p.customIssue}` : 'Other') : (issue?.title ?? '')
      next.title = buildSuggestedTitle(selectedGroup, middle)
      return next
    })
  }

  useEffect(() => {
    if (!initialAssetId) return
    let active = true
    fetch('/api/assets')
      .then(r => (r.ok ? r.json() : []))
      .then((list: PickedAsset[]) => {
        if (active) return
        const asset = Array.isArray(list) ? list.find(a => a.id === initialAssetId) : undefined
        if (asset) {
          assetNameRef.current = asset.name
          setForm(p => (p.assetId === initialAssetId ? { ...p, location: asset.location?.path ?? asset.location?.name ?? '' } : p))
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [initialAssetId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true); setError('')
    try {
      const uploaded: AttachmentUpload[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Upload failed'); continue }
        uploaded.push({ url: data.url, originalName: data.name ?? file.name, mimeType: data.type ?? file.type, size: data.size ?? file.size })
      }
      setAttachments(prev => [...prev, ...uploaded])
    } catch { setError('Upload failed — try again') } finally { setUploading(false) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    if (currentUser && !form.assetId) {
      setError('Please select an asset for your request')
      setSaving(false)
      return
    }
    if (!form.requestType) {
      setError('Please select a request type')
      setSaving(false)
      return
    }
    if (hasIssues && !form.domainId) {
      setError('Please select a domain for your request')
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
        type: form.requestType === 'REPAIR' ? 'BREAKDOWN' : 'PREVENTIVE',
        priority: form.priority,
        status: 'OPEN',
        assetId: form.assetId || undefined,
        dueDate: form.desiredDate || undefined,
        downtimeStartedAt: form.downtimeStartedAt ? new Date(form.downtimeStartedAt).toISOString() : undefined,
        issueId: form.issueId === OTHER_ISSUE ? undefined : (form.issueId || undefined),
        domainId: form.domainId && !selectedGroup?.isFallback ? form.domainId : undefined,
        customIssue: form.issueId === OTHER_ISSUE ? form.customIssue.trim() : undefined,
        teamId: form.teamId,
        attachments: attachments.length > 0 ? attachments : undefined,
      }
      const res  = await fetch('/api/work-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to submit'); return }
      setSuccess(true)
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Work order created!</h2>
          <p className="text-gray-500 text-sm">Your work order has been created and assigned to the selected maintenance team. Track its progress from My Work Orders.</p>
          <button
            onClick={() => { setSuccess(false); assetNameRef.current = ''; setForm({ ...EMPTY_FORM, requesterName: currentUser?.name ?? '', requesterEmail: currentUser?.email ?? '' }); setAttachments([]) }}
            className="mt-6 btn-secondary text-sm">Submit another request</button>
          {currentUser && (
            <Link href="/my-work-orders" className="mt-3 btn-primary text-sm inline-flex items-center justify-center w-full">
              View My Work Orders
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">New Work Order</h1>
          <p className="text-gray-500 text-sm mt-1">Report an issue or request maintenance work</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request title <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} readOnly className="input-field bg-gray-50" placeholder="Auto-generated after selecting domain & issue" />
              <p className="text-[11px] text-gray-400 mt-1">Auto-generated from your selections.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input-field resize-none" rows={4} placeholder="Please describe the problem in detail..." required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request type <span className="text-red-500">*</span></label>
              <select value={form.requestType} onChange={e => set('requestType', e.target.value)} className="input-field" required>
                <option value="">Select type</option>
                <option value="REPAIR">Repair</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INSPECTION">Inspection</option>
                <option value="INSTALLATION">Installation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            {currentUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset <span className="text-red-500">*</span></label>
                <RequestAssetPicker value={form.assetId} onChange={handleAssetChange} />
                <p className="text-[11px] text-gray-400 mt-1">Select the asset this request is about. Location auto-fills from it.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain / Nature <span className="text-red-500">*</span></label>
              <select value={form.domainId} onChange={e => handleDomainChange(e.target.value)} className="input-field" disabled={!hasIssues}>
                <option value="">{issuesLoading ? 'Loading…' : 'Select the domain'}</option>
                {selectableGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.isFallback ? 'Common Issues' : g.name}</option>
                ))}
              </select>
              {form.domainId && selectedGroup && (
                <>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue <span className="text-red-500">*</span></label>
                    <select
                      value={form.issueId}
                      onChange={e => handleIssueChange(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select the issue</option>
                      {selectedGroupIssues.map(i => (
                        <option key={i.id} value={i.id}>{i.title} ({i.code})</option>
                      ))}
                      <option value={OTHER_ISSUE}>Other (type manually)</option>
                    </select>
                  </div>
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
                </>
              )}
              <p className="text-[11px] text-gray-400 mt-1">What problem are you reporting? This helps the maintenance team triage faster. Priority is suggested from the issue severity.</p>
            </div>
            {currentUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                {form.assetId ? (
                  form.location ? (
                    <div className="input-field bg-gray-50 text-gray-500 flex items-center gap-2">
                      <span className="truncate">{form.location}</span>
                    </div>
                  ) : (
                    <div className="input-field bg-gray-50 text-gray-400">
                      This asset has no location assigned
                    </div>
                  )
                ) : (
                  <div className="input-field bg-gray-50 text-gray-400">
                    Select an asset to see its location
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-1">Read-only — location comes from the selected asset.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => handlePriorityChange(e.target.value)} className="input-field">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical — urgent!</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Suggested from the issue severity — you can adjust it.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Machine down since</label>
              <input type="datetime-local" value={form.downtimeStartedAt} onChange={e => set('downtimeStartedAt', e.target.value)} className="input-field" />
              <p className="text-[11px] text-gray-400 mt-1">Optional — if the machine is down, when did it stop working? This helps the team prioritize.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desired completion date</label>
              <input type="date" value={form.desiredDate} onChange={e => set('desiredDate', e.target.value)} className="input-field" />
              <p className="text-[11px] text-gray-400 mt-1">Optional — when would you like this completed?</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photos / attachments</label>
              <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden group">
                      {a.mimeType.startsWith('image/') ? (
                        <img src={a.url} alt={a.originalName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-gray-400 bg-gray-50 px-1 text-center">{a.originalName.slice(0, 12)}</div>
                      )}
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50">
                <ImagePlus className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Add photo or file'}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance team <span className="text-red-500">*</span></label>
              <select value={form.teamId} onChange={e => set('teamId', e.target.value)} className="input-field">
                <option value="">Select the team</option>
                {assignTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">The maintenance team that will handle this work order.</p>
            </div>
            {currentUser ? (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="text-sm text-gray-600">
                  Submitting as <span className="font-medium text-gray-900">{currentUser.name}</span> ({currentUser.email})
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your contact details</p>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.requesterName} onChange={e => set('requesterName', e.target.value)} className="input-field" placeholder="Full name" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={form.requesterEmail} onChange={e => set('requesterEmail', e.target.value)} className="input-field" placeholder="you@example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input type="text" value={form.requesterPhone} onChange={e => set('requesterPhone', e.target.value)} className="input-field" placeholder="+1 555 000 0000" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={saving || uploading} className="btn-primary w-full py-3 text-base">
              {saving ? 'Submitting...' : 'Submit work order'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
