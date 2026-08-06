'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Settings, CheckCircle, X, ImagePlus } from 'lucide-react'
import RequestAssetPicker from '@/components/RequestAssetPicker'
import WorkOrderIssueSelector from '@/components/WorkOrderIssueSelector'

interface CurrentUser {
  name: string
  email: string
  role: string
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
  title: '', description: '', location: '', requesterName: '', requesterEmail: '', requesterPhone: '',
  priority: 'MEDIUM', requestType: '', assetId: '', desiredDate: '', downtimeStartedAt: '', issueId: '', teamId: '',
}

export default function PublicRequestForm({ currentUser }: { currentUser: CurrentUser | null }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    requesterName: currentUser?.name ?? '',
    requesterEmail: currentUser?.email ?? '',
  })
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [issueGroups, setIssueGroups] = useState<DomainGroup[]>([])
  const [issuesLoading, setIssuesLoading] = useState(true)

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [recommendation, setRecommendation] = useState<{
    team: { id: string; name: string } | null
    teams: { id: string; name: string }[]
  } | null>(null)
  const lastAutoPriority = useRef<string | null>(null)
  const autoLocRef = useRef<string | null>(null)
  const [locations, setLocations] = useState<{ id: string; name: string; parentId: string | null; path: string }[]>([])
  const [customLocation, setCustomLocation] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    let active = true
    fetch('/api/locations')
      .then(r => (r.ok ? r.json() : []))
      .then((nested: any[]) => {
        if (!active) return
        const flat: { id: string; name: string; parentId: string | null; path: string }[] = []
        const walk = (nodes: any[], parentId: string | null, prefix: string) => {
          for (const n of nodes) {
            const path = prefix ? `${prefix} › ${n.name}` : n.name
            flat.push({ id: n.id, name: n.name, parentId: parentId ?? null, path })
            if (Array.isArray(n.children) && n.children.length > 0) walk(n.children, n.id, path)
          }
        }
        walk(Array.isArray(nested) ? nested : [], null, '')
        setLocations(flat)
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

  useEffect(() => {
    if (!currentUser) return
    let active = true
    fetch('/api/teams')
      .then(r => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (active) setTeams(Array.isArray(list) ? list.map(t => ({ id: t.id, name: t.name })) : [])
      })
      .catch(() => {})
    return () => { active = false }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser || !form.assetId) { setRecommendation(null); return }
    let active = true
    fetch(`/api/recommendations?assetId=${encodeURIComponent(form.assetId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((rec: { team: { id: string; name: string } | null; teams: { id: string; name: string }[] } | null) => {
        if (active) setRecommendation(rec)
      })
      .catch(() => {})
    return () => { active = false }
  }, [currentUser, form.assetId])

  const hasIssues = issueGroups.some(g => (g.issues?.length ?? 0) > 0)

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

  function handleIssueChange(id: string) {
    const issue = issueGroups.flatMap(g => g.issues ?? []).find(i => i.id === id)
    setForm(p => {
      const next = { ...p, issueId: id }
      if (issue?.severity && (p.priority === lastAutoPriority.current || !lastAutoPriority.current)) {
        next.priority = issue.severity
        lastAutoPriority.current = issue.severity
      }
      return next
    })
  }

  function handlePriorityChange(v: string) {
    lastAutoPriority.current = null
    set('priority', v)
  }

  function handleAssetChange(asset: any) {
    const id = asset?.id ?? ''
    setForm(p => {
      const next = { ...p, assetId: id }
      const assetLoc = asset?.location?.name
      if (id && assetLoc && (p.location === autoLocRef.current || !p.location)) {
        const matched = locations.find(l => l.name === assetLoc)
        next.location = matched?.path ?? assetLoc
        autoLocRef.current = next.location
        setCustomLocation(false)
      } else if (!id && p.location === autoLocRef.current) {
        next.location = ''
        autoLocRef.current = null
      }
      return next
    })
  }

  useEffect(() => {
    if (!locations.length || !autoLocRef.current) return
    const matched = locations.find(l => l.name === autoLocRef.current)
    if (matched && matched.path !== autoLocRef.current) {
      setForm(p => (p.location === autoLocRef.current ? { ...p, location: matched.path } : p))
      autoLocRef.current = matched.path
    }
  }, [locations])

  function handleLocationPick(value: string) {
    if (value === '__other__') {
      setCustomLocation(true)
      set('location', '')
      return
    }
    setCustomLocation(false)
    set('location', value)
  }

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
    if (hasIssues && !form.issueId) {
      setError('Please select an issue for your request')
      setSaving(false)
      return
    }
    try {
      const payload = {
        ...form,
        requestType: form.requestType || undefined,
        assetId: form.assetId || undefined,
        desiredDate: form.desiredDate || undefined,
        downtimeStartedAt: form.downtimeStartedAt ? new Date(form.downtimeStartedAt).toISOString() : undefined,
        issueId: form.issueId || undefined,
        teamId: form.teamId || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      }
      const res  = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request submitted!</h2>
          <p className="text-gray-500 text-sm">Your maintenance request has been received. The maintenance team will review it shortly.</p>
          <button
            onClick={() => { setSuccess(false); setForm({ ...EMPTY_FORM, requesterName: currentUser?.name ?? '', requesterEmail: currentUser?.email ?? '' }); setAttachments([]) }}
            className="mt-6 btn-secondary text-sm">Submit another request</button>
          {currentUser && (
            <Link href="/my-requests" className="mt-3 btn-primary text-sm inline-flex items-center justify-center w-full">
              View My Requests
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
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Request</h1>
          <p className="text-gray-500 text-sm mt-1">Report an issue or request maintenance work</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request title <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className="input-field" placeholder="Brief description of the issue" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input-field resize-none" rows={4} placeholder="Please describe the problem in detail..." required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request type</label>
                <select value={form.requestType} onChange={e => set('requestType', e.target.value)} className="input-field">
                  <option value="">Select type</option>
                  <option value="REPAIR">Repair</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INSPECTION">Inspection</option>
                  <option value="INSTALLATION">Installation</option>
                  <option value="OTHER">Other</option>
                </select>
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue <span className="text-red-500">*</span></label>
              <WorkOrderIssueSelector
                groups={issueGroups}
                value={form.issueId}
                onChange={handleIssueChange}
                placeholder={issuesLoading ? 'Loading issues…' : 'Select the issue'}
                allowCustom={false}
              />
              <p className="text-[11px] text-gray-400 mt-1">What problem are you reporting? This helps the maintenance team triage faster. Priority is suggested from the issue severity.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                {currentUser ? (
                  customLocation ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.location}
                        onChange={e => { autoLocRef.current = null; set('location', e.target.value) }}
                        className="input-field flex-1"
                        placeholder="Type a location..."
                      />
                      <button
                        type="button"
                        onClick={() => setCustomLocation(false)}
                        className="btn-secondary text-xs px-3 shrink-0"
                      >
                        Pick
                      </button>
                    </div>
                  ) : (
                    <select
                      value={form.location}
                      onChange={e => handleLocationPick(e.target.value)}
                      className="input-field"
                    >
                      <option value="">No location</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.path}>{l.path}</option>
                      ))}
                      <option value="__other__">Other — type a custom location…</option>
                    </select>
                  )
                ) : (
                  <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className="input-field" placeholder="e.g. Building A, Room 204" />
                )}
                {currentUser && form.location && !locations.some(l => l.path === form.location) && !customLocation && (
                  <p className="text-[11px] text-gray-400 mt-1">Selected location is free-text. Pick from the list or choose &ldquo;Other&rdquo;.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desired completion date</label>
                <input type="date" value={form.desiredDate} onChange={e => set('desiredDate', e.target.value)} className="input-field" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Machine down since</label>
              <input type="datetime-local" value={form.downtimeStartedAt} onChange={e => set('downtimeStartedAt', e.target.value)} className="input-field" />
              <p className="text-[11px] text-gray-400 mt-1">Optional — if the machine is down, when did it stop working? This helps the team prioritize.</p>
            </div>
            {currentUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                <RequestAssetPicker value={form.assetId} onChange={handleAssetChange} />
                <p className="text-[11px] text-gray-400 mt-1">Optional — pick the asset this request is about. Location auto-fills from it.</p>
              </div>
            )}
            {currentUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <select value={form.teamId} onChange={e => set('teamId', e.target.value)} className="input-field">
                  <option value="">Select a team (optional)</option>
                  {(() => {
                    const recommended = recommendation?.teams?.length
                      ? recommendation.teams
                      : (recommendation?.team ? [recommendation.team] : [])
                    const recommendedIds = new Set(recommended.map(t => t.id))
                    const otherTeams = teams.filter(t => !recommendedIds.has(t.id))
                    return (
                      <>
                        {recommended.length > 0 && (
                          <optgroup label="⭐ Recommended">
                            {recommended.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {otherTeams.length > 0 && (
                          <optgroup label="All teams">
                            {otherTeams.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )
                  })()}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Recommended teams appear at the top based on the asset&apos;s domain.</p>
              </div>
            )}
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
            {currentUser ? (
              <div className="border-t border-gray-100 pt-4 text-sm text-gray-600">
                Submitting as <span className="font-medium text-gray-900">{currentUser.name}</span> ({currentUser.email})
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
              {saving ? 'Submitting...' : 'Submit request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
