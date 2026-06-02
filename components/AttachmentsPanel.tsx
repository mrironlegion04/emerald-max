'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

interface Attachment { id: string; originalName: string; mimeType: string; size: number; url: string; uploadedBy: string | null; createdAt: string | Date }
interface Props {
  attachments: Attachment[]
  entityType: 'workOrder' | 'asset' | 'part'
  entityId: string
  canEdit: boolean
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return '🖼'
  if (mime === 'application/pdf') return '📄'
  return '📎'
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}
function fmt(d: string | Date) { return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d instanceof Date ? d : new Date(d)) }

export default function AttachmentsPanel({ attachments, entityType, entityId, canEdit }: Props) {
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [files,     setFiles]    = useState(attachments)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]    = useState('')
  const [deleting,  setDeleting] = useState<string | null>(null)

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      Array.from(selected).forEach(f => fd.append('file', f))
      fd.append('entityType', entityType)
      fd.append('entityId', entityId)
      const res  = await fetch('/api/attachments', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
      setFiles(prev => [...prev, ...data])
      router.refresh()
    } catch { setError('Upload failed') } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remove(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/attachments/${id}`, { method: 'DELETE' })
      setFiles(prev => prev.filter(f => f.id !== id))
      router.refresh()
    } finally { setDeleting(null) }
  }

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/10">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight flex items-center gap-1.5">
          Attachments
          <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
            {files.length}
          </span>
        </h2>
        {canEdit && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-xs text-blue-600 hover:text-blue-850 hover:underline font-bold transition disabled:opacity-50">
            {uploading ? 'Uploading...' : '+ Upload files'}
          </button>
        )}
        <input ref={fileRef} type="file" multiple className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={upload} />
      </div>

      {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-5 py-2.5">{error}</p>}

      {files.length === 0 ? (
        <div className="py-12 text-center bg-white">
          <p className="text-xs text-slate-400 font-semibold mb-1">No attachments yet</p>
          {canEdit && (
            <button onClick={() => fileRef.current?.click()}
              className="text-[11px] text-blue-600 hover:text-blue-850 hover:underline font-bold transition">Upload a file</button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-55/40 transition-colors">
              <span className="text-lg bg-slate-100 border border-slate-200/50 p-1.5 rounded-lg flex-shrink-0 flex items-center justify-center">
                {fileIcon(f.mimeType)}
              </span>
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 truncate block transition-colors leading-tight">{f.originalName}</span>
                  <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] uppercase font-bold text-blue-650 hover:text-blue-800 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded transition">
                    View
                  </a>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                  {fmtSize(f.size)} · {fmt(f.createdAt)}{f.uploadedBy ? ` · ${f.uploadedBy}` : ''}
                </p>
              </div>
              {canEdit && (
                <button onClick={() => remove(f.id)} disabled={deleting === f.id}
                  className="text-slate-350 hover:text-rose-600 transition-colors flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}