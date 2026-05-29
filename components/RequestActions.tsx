'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { requestId: string; title: string }

export default function RequestActions({ requestId, title }: Props) {
  const router  = useRouter()
  const [mode, setMode]     = useState<'idle'|'reject'|'convert'>('idle')
  const [loading, setLoading] = useState(false)
  const [reason,  setReason]  = useState('')
  const [error,   setError]   = useState('')

  async function doAction(action: string, extra?: Record<string,unknown>) {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  if (mode === 'reject') return (
    <div className="w-full md:w-64 space-y-3 bg-rose-50/30 p-3 rounded-xl border border-rose-100">
      <textarea 
        value={reason} 
        onChange={e => setReason(e.target.value)} 
        className="input-field text-xs sm:text-sm resize-none w-full bg-white min-h-[80px]" 
        rows={3} 
        placeholder="Reason for rejection..." 
      />
      {error && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{error}</p>}
      <div className="flex gap-2">
        <button 
          onClick={() => doAction('reject', { reason })} 
          disabled={loading} 
          className="flex-1 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white uppercase tracking-wider py-2.5 px-3 rounded-lg shadow-sm disabled:opacity-50 transition-all active:scale-95"
        >
          {loading ? '...' : 'Reject'}
        </button>
        <button 
          onClick={() => setMode('idle')} 
          className="flex-1 text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-lg active:scale-95 transition-all shadow-3xs"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-row md:flex-col gap-2 w-full md:w-40 flex-wrap">
      {error && <p className="w-full text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">{error}</p>}
      <button 
        onClick={() => doAction('approve')} 
        disabled={loading}
        className="flex-1 md:w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl shadow-[0_2px_10px_-3px_rgba(16,185,129,0.3)] transition-all active:scale-95"
      >
        {loading ? '...' : 'Approve'}
      </button>
      <button 
        onClick={() => doAction('convert')} 
        disabled={loading}
        className="flex-1 md:w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl shadow-[0_2px_10px_-3px_rgba(37,99,235,0.3)] transition-all active:scale-95"
      >
        {loading ? '...' : 'Convert'}
      </button>
      <button 
        onClick={() => setMode('reject')} 
        className="flex-1 md:w-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-3xs transition-all active:scale-95"
      >
        Reject
      </button>
    </div>
  )
}