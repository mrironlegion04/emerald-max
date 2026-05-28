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
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">
          Attachments <span className="text-gray-400 font-normal">({files.length})</span>
        </h2>
        {canEdit && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-xs text-blue-600 hover:underline font-medium disabled:opacity-50">
            {uploading ? 'Uploading...' : '+ Upload files'}
          </button>
        )}
        <input ref={fileRef} type="file" multiple className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={upload} />
      </div>

      {error && <p className="text-xs text-red-600 px-5 pt-3">{error}</p>}

      {files.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-400">No attachments yet</p>
          {canEdit && (
            <button onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs text-blue-600 hover:underline">Upload a file</button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xl flex-shrink-0">{fileIcon(f.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <a href={f.url} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline truncate block">{f.originalName}</a>
                <p className="text-xs text-gray-400">
                  {fmtSize(f.size)} · {fmt(f.createdAt)}{f.uploadedBy ? ` · ${f.uploadedBy}` : ''}
                </p>
              </div>
              {canEdit && (
                <button onClick={() => remove(f.id)} disabled={deleting === f.id}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}