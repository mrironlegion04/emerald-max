'use client'

import { useState, useEffect, useRef } from 'react'
import { fmtDateTime } from '@/lib/utils'

interface Comment {
  id: string; content: string
  authorName: string; authorRole: string; createdAt: string
}

interface Props { woId: string; woStatus: string }

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  TECHNICIAN: 'bg-green-100 text-green-700',
}

export default function WOCommentsPanel({ woId, woStatus }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [content,  setContent]  = useState('')
  const [posting,  setPosting]  = useState(false)
  const [error,    setError]    = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const res  = await fetch(`/api/work-orders/${woId}/comments`)
      const data = await res.json()
      if (res.ok) setComments(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [woId])

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true); setError('')
    try {
      const res  = await fetch(`/api/work-orders/${woId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setComments(prev => [...prev, data])
      setContent('')
    } catch { setError('Network error') }
    finally  { setPosting(false) }
  }

  const isClosed = ['COMPLETED','CANCELLED'].includes(woStatus)

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200/50 shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight flex items-center gap-1.5">
          Comments
          <span className="text-xs bg-slate-100/80 text-slate-500 font-bold px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </h2>
      </div>

      {/* Comments list */}
      <div className="divide-y divide-slate-100/60 max-h-80 overflow-y-auto bg-white">
        {loading && (
          <div className="px-5 py-8 text-center text-xs text-slate-400 font-medium">Loading comments...</div>
        )}
        {!loading && comments.length === 0 && (
          <div className="px-5 py-10 text-center text-xs text-slate-400 font-medium">
            No comments yet — be the first to start the conversation.
          </div>
        )}
        {comments.map(c => (
          <div key={c.id} className="px-5 py-4 hover:bg-slate-50/10 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 border border-blue-200/50 shadow-xs">
                <span className="text-blue-700 font-bold text-[10px] tracking-wider">
                  {c.authorName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-800">{c.authorName}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColors[c.authorRole] ?? 'bg-slate-100 text-slate-600'}`}>
                {c.authorRole}
              </span>
              <span className="text-[10px] font-medium text-slate-400 ml-auto">{fmtDateTime(c.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-650 leading-relaxed pl-8 whitespace-pre-wrap">{c.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Post comment */}
      {!isClosed && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/55">
          <form onSubmit={post} className="space-y-3">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Add an update or question about this work order..."
              className="input-field resize-none text-xs w-full min-h-[50px] bg-white border-slate-200"
              rows={2}
            />
            {error && <p className="text-xs text-red-650 bg-red-50 px-2 py-1 rounded border border-red-100">{error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={posting || !content.trim()} className="btn-primary text-xs py-2 px-4 shadow-sm shadow-blue-50">
                {posting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}