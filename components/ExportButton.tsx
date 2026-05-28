'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown } from 'lucide-react'

type ExportType = 'work-orders' | 'assets' | 'inventory' | 'audit'

interface ExportOption {
  type: ExportType
  label: string
}

const allOptions: ExportOption[] = [
  { type: 'work-orders', label: 'Work orders (CSV)' },
  { type: 'assets',      label: 'Assets (CSV)' },
  { type: 'inventory',   label: 'Inventory / parts (CSV)' },
  { type: 'audit',       label: 'Audit log (CSV)' },
]

interface Props {
  types?: ExportType[]   // restrict which options to show; default = all
  label?: string
  canExport?: boolean    // if false, button is hidden (default: true)
}

export default function ExportButton({ types, label = 'Export', canExport = true }: Props) {
  if (!canExport) return null
  const [open,       setOpen]       = useState(false)
  const [exporting,  setExporting]  = useState<ExportType | null>(null)
  const [error,      setError]      = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const options = types
    ? allOptions.filter(o => types.includes(o.type))
    : allOptions

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function doExport(type: ExportType) {
    setExporting(type); setError(''); setOpen(false)
    try {
      const res = await fetch(`/api/export?type=${type}`)
      if (!res.ok) { setError('Export failed'); return }
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const cd       = res.headers.get('content-disposition') ?? ''
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] ?? `export.csv`
      const a        = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { setError('Export failed') }
    finally  { setExporting(null) }
  }

  if (options.length === 1) {
    return (
      <div>
        <button
          onClick={() => doExport(options[0].type)}
          disabled={!!exporting}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : label}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!!exporting}
        className="btn-secondary text-sm flex items-center gap-1.5"
      >
        <Download className="w-4 h-4" />
        {exporting ? 'Exporting...' : label}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-20 py-1.5">
          {options.map(opt => (
            <button
              key={opt.type}
              onClick={() => doExport(opt.type)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1 absolute right-0 whitespace-nowrap">{error}</p>}
    </div>
  )
}