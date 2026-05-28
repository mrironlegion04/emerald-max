'use client'
import { useState } from 'react'
import { Settings, CheckCircle } from 'lucide-react'

export default function PublicRequestPage() {
  const [form, setForm] = useState({ title: '', description: '', location: '', requesterName: '', requesterEmail: '', requesterPhone: '', priority: 'MEDIUM' })
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const res  = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
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
          <button onClick={() => { setSuccess(false); setForm({ title: '', description: '', location: '', requesterName: '', requesterEmail: '', requesterPhone: '', priority: 'MEDIUM' }) }}
            className="mt-6 btn-secondary text-sm">Submit another request</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={e => set('location', e.target.value)} className="input-field" placeholder="e.g. Building A, Room 204" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input-field">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical — urgent!</option>
                </select>
              </div>
            </div>
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
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
              {saving ? 'Submitting...' : 'Submit request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}