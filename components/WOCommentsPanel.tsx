'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Paperclip, X, Pencil, Trash2, SmilePlus, Loader2, FileText, Image as ImageIcon,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/utils'

interface Reaction { emoji: string; count: number; reactedByMe: boolean }
interface AttachmentItem {
  id: string; filename: string; originalName: string; mimeType: string; size: number; url: string
  uploadedBy?: { name: string } | null
}
interface Comment {
  id: string; content: string; authorId: string | null; authorName: string; authorRole: string
  createdAt: string; updatedAt: string; isEdited: boolean
  attachments: AttachmentItem[]; reactions: Reaction[]
}
interface Payload {
  comments: Comment[]; currentUserId: string | null; currentUserRole: string | null
}
interface MentionUser { id: string; name: string; role: string }

interface Props { woId: string; woStatus: string }

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥']

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-200/50',
  MANAGER: 'bg-blue-100 text-blue-700 border-blue-200/50',
  TECHNICIAN: 'bg-green-100 text-green-700 border-green-200/50',
  REQUESTER: 'bg-orange-100 text-orange-700 border-orange-200/50',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function WOCommentsPanel({ woId, woStatus }: Props) {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<{ id: string; role: string } | null>(null)

  // Composer state
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit / delete / reaction state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  // Mention state
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionUser[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [stickToBottom, setStickToBottom] = useState(true)

  const isReadOnly = ['CLOSED', 'CANCELLED'].includes(woStatus)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${woId}/comments`)
      const data = await res.json()
      if (res.ok) {
        setPayload(data)
        setMe(data.currentUserId ? { id: data.currentUserId, role: data.currentUserRole ?? null } : null)
      }
    } finally {
      setLoading(false)
    }
  }, [woId])

  useEffect(() => { load() }, [load])

  // Real-time via SSE
  useEffect(() => {
    const es = new EventSource(`/api/work-orders/${woId}/comments/stream`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setPayload(data)
        setMe(data.currentUserId ? { id: data.currentUserId, role: data.currentUserRole ?? null } : null)
      } catch { /* ignore malformed frames */ }
    }
    es.onerror = () => { /* EventSource auto-reconnects */ }
    return () => es.close()
  }, [woId])

  const comments = payload?.comments ?? []

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom) el.scrollTop = el.scrollHeight
  }, [comments.length, stickToBottom])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setStickToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  // @mention search (composer only)
  const searchMentions = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok) {
        setMentionSuggestions(data)
        setShowMentions(data.length > 0)
        setMentionIndex(0)
      }
    } catch {
      setMentionSuggestions([])
      setShowMentions(false)
    }
  }, [])

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    const cursorPos = e.target.selectionStart
    const textBefore = val.slice(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      const query = atMatch[1]
      setMentionQuery(query)
      if (mentionTimeout.current) clearTimeout(mentionTimeout.current)
      mentionTimeout.current = setTimeout(() => searchMentions(query), 200)
    } else {
      setShowMentions(false)
      setMentionQuery('')
    }
  }

  function applyMention(name: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursorPos = textarea.selectionStart
    const textBefore = content.slice(0, cursorPos)
    const textAfter = content.slice(cursorPos)
    const atIndex = textBefore.lastIndexOf('@')
    const cleanName = name.replace(/\s+/g, '')
    const newText = textBefore.slice(0, atIndex) + `@${cleanName} ` + textAfter
    setContent(newText)
    setShowMentions(false)
    setMentionQuery('')
    setTimeout(() => {
      textarea.focus()
      const newPos = atIndex + cleanName.length + 2
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function handleMentionKeyDown(e: React.KeyboardEvent) {
    if (!showMentions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && showMentions) {
      e.preventDefault()
      applyMention(mentionSuggestions[mentionIndex].name)
    } else if (e.key === 'Escape') {
      setShowMentions(false)
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentions) return handleMentionKeyDown(e)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void post()
    }
  }

  async function post() {
    if (!content.trim() && files.length === 0) return
    setPosting(true); setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      if (files.length > 0) {
        const fd = new FormData()
        fd.set('entityType', 'comment')
        fd.set('entityId', data.id)
        files.forEach(f => fd.append('file', f))
        const up = await fetch('/api/attachments', { method: 'POST', body: fd })
        if (!up.ok) setError('Comment posted, but some attachments failed to upload.')
      }
      setContent('')
      setFiles([])
      setStickToBottom(true)
      await load()
    } catch {
      setError('Network error')
    } finally {
      setPosting(false)
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) setFiles(prev => [...prev, ...picked])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function saveEdit() {
    if (!editingId || !editContent.trim()) return
    setSavingEdit(true); setEditError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/comments/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Failed'); return }
      setEditingId(null); setEditContent('')
      await load()
    } catch {
      setEditError('Network error')
    } finally {
      setSavingEdit(false)
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void saveEdit()
    } else if (e.key === 'Escape') {
      setEditingId(null); setEditContent(''); setEditError('')
    }
  }

  async function confirmDelete() {
    if (!deletingId) return
    setDeleting(true)
    try {
      await fetch(`/api/work-orders/${woId}/comments/${deletingId}`, { method: 'DELETE' })
      setDeletingId(null)
      await load()
    } catch {
      setError('Failed to delete comment')
    } finally {
      setDeleting(false)
    }
  }

  async function toggleReaction(commentId: string, emoji: string) {
    try {
      const res = await fetch(`/api/work-orders/${woId}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      if (!res.ok) return
      const data = await res.json()
      setPayload(p => p ? { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, reactions: data.reactions } : c) } : p)
    } catch { /* ignore */ }
  }

  function renderContent(text: string) {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="font-bold text-blue-600 bg-blue-50 px-1 rounded">{part}</span>
      }
      return part
    })
  }

  const canModerate = (c: Comment) => c.authorId === me?.id
  const canDelete = (c: Comment) =>
    c.authorId === me?.id || me?.role === 'ADMIN' || me?.role === 'MANAGER'

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200/50 shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight flex items-center gap-1.5">
          Comments
          <span className="text-xs bg-slate-100/80 text-slate-500 font-bold px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </h2>
        {!isReadOnly && (
          <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
            Photos, files &amp; reactions
          </span>
        )}
      </div>

      {/* Comment list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[28rem] overflow-y-auto bg-white divide-y divide-slate-100/60"
      >
        {loading && (
          <div className="px-5 py-8 text-center text-xs text-slate-400 font-medium">Loading comments...</div>
        )}
        {!loading && comments.length === 0 && (
          <div className="px-5 py-10 text-center text-xs text-slate-400 font-medium">
            No comments yet — start the conversation.
          </div>
        )}

        {comments.map(c => {
          const isMine = canModerate(c)
          const editing = editingId === c.id
          return (
            <div key={c.id} className="px-5 py-4 group hover:bg-slate-50/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border text-[10px] font-bold ${roleColors[c.authorRole] ?? 'bg-slate-100 text-slate-600 border-slate-200/50'}`}>
                  {initials(c.authorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{c.authorName}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${roleColors[c.authorRole] ?? 'bg-slate-100 text-slate-600'}`}>
                      {c.authorRole}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      {fmtDateTime(c.createdAt)}
                      {c.isEdited && <span className="italic text-slate-400"> (edited)</span>}
                    </span>
                  </div>

                  {editing ? (
                    <div className="mt-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                        rows={2}
                        className="input-field resize-none text-xs w-full bg-white border-slate-200"
                      />
                      {editError && <p className="text-xs text-red-650 bg-red-50 px-2 py-1 rounded mt-1">{editError}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => void saveEdit()}
                          disabled={savingEdit || !editContent.trim()}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent(''); setEditError('') }}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-650 leading-relaxed mt-1 whitespace-pre-wrap">{renderContent(c.content)}</p>
                  )}

                  {/* Attachments */}
                  {!editing && c.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {c.attachments.map(a => (
                        a.mimeType?.startsWith('image/') ? (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.originalName}>
                            <img src={a.url} alt={a.originalName} className="w-14 h-14 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                          </a>
                        ) : (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-colors max-w-[220px]">
                            {a.mimeType?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                            <span className="truncate">{a.originalName}</span>
                            <span className="text-[9px] text-slate-400 flex-shrink-0">{formatBytes(a.size)}</span>
                          </a>
                        )
                      ))}
                    </div>
                  )}

                  {/* Reactions */}
                  {!editing && c.reactions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {c.reactions.map(r => (
                        <button
                          key={r.emoji}
                          onClick={() => { if (!isReadOnly) void toggleReaction(c.id, r.emoji) }}
                          disabled={isReadOnly}
                          className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border transition-colors ${
                            r.reactedByMe
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="font-semibold">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Hover actions + reaction picker */}
              {!isReadOnly && (
                <div className="relative flex items-center gap-1 mt-1 pl-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPickerFor(pickerFor === c.id ? null : c.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    title="React"
                  >
                    <SmilePlus className="w-3.5 h-3.5" />
                  </button>
                  {isMine && (
                    <button
                      onClick={() => { setEditingId(c.id); setEditContent(c.content); setEditError(''); setPickerFor(null) }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete(c) && (
                    <button
                      onClick={() => setDeletingId(deletingId === c.id ? null : c.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {pickerFor === c.id && (
                    <div className="absolute left-10 top-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg px-1.5 py-1 flex items-center gap-0.5">
                      {REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => { void toggleReaction(c.id, emoji); setPickerFor(null) }}
                          className="p-1 rounded-md hover:bg-slate-100 text-base leading-none transition-transform hover:scale-110"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {deletingId === c.id && (
                    <div className="absolute left-10 top-0 z-20 flex items-center gap-1.5 bg-white border border-red-100 rounded-lg shadow-lg px-2 py-1">
                      <span className="text-[11px] text-slate-600 font-medium">Delete this comment?</span>
                      <button
                        onClick={() => void confirmDelete()}
                        disabled={deleting}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting ? '...' : 'Confirm'}
                      </button>
                      <button onClick={() => setDeletingId(null)} className="text-[11px] font-medium text-slate-500 hover:text-slate-700">Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Composer */}
      {!isReadOnly && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/55 relative">
          {error && <p className="text-xs text-red-650 bg-red-50 px-2 py-1 rounded border border-red-100 mb-2">{error}</p>}

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 max-w-[200px]">
                  {f.type?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600 flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleCommentChange}
              onKeyDown={handleComposerKeyDown}
              placeholder="Write a comment... Use @name to tag someone"
              className="input-field resize-none text-xs w-full min-h-[48px] bg-white border-slate-200 pr-20"
              rows={2}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                className="hidden"
                onChange={onPickFiles}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file or photo"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void post()}
                disabled={posting || (!content.trim() && files.length === 0)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                title="Send"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            {/* Mention suggestions */}
            {showMentions && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                {mentionSuggestions.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => applyMention(u.name)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-blue-50 transition-colors ${i === mentionIndex ? 'bg-blue-50' : ''}`}
                  >
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span className="text-gray-400 text-[10px]">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
