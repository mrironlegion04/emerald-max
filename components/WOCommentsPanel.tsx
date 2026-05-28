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
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">
          Comments
          <span className="ml-2 text-gray-400 font-normal">({comments.length})</span>
        </h2>
      </div>

      {/* Comments list */}
      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {loading && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Loading...</div>
        )}
        {!loading && comments.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No comments yet — be the first to add one.
          </div>
        )}
        {comments.map(c => (
          <div key={c.id} className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 font-semibold text-xs">
                  {c.authorName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
              <span className={`badge text-xs ${roleColors[c.authorRole] ?? 'bg-gray-100 text-gray-600'}`}>
                {c.authorRole}
              </span>
              <span className="text-xs text-gray-400 ml-auto">{fmtDateTime(c.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed pl-8 whitespace-pre-wrap">{c.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Post comment */}
      {!isClosed && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <form onSubmit={post} className="space-y-2">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Add a comment, update, or question..."
              className="input-field resize-none text-sm w-full"
              rows={2}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={posting || !content.trim()} className="btn-primary text-sm">
                {posting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}