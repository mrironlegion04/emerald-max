'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Download, UploadCloud } from 'lucide-react'

type ImportType = 'assets' | 'parts'

interface ImportResult {
  created: number; skipped: number; errors: string[]; total: number
}

const TEMPLATES: Record<ImportType, { headers: string[]; example: string[] }> = {
  assets: {
    headers: ['name','asset_code','status','category','location','manufacturer','model','serial_number','purchase_date','purchase_cost','description','criticality','warranty_expiry','warranty_notes','meter_unit','current_meter_value','parent_asset_code'],
    example: ['Air Compressor #5','AST-005','ACTIVE','Mechanical','Building C','Atlas Copco','GA37','SN-12345','2024-01-15','18000','50HP compressor','HIGH','2026-01-15','Full warranty on motor','hours','120.5',''],
  },
  parts: {
    headers: ['name','part_number','description','unit_cost','unit'],
    example: ['Drive Belt','PRT-BELT-05','V-belt for compressors','24.50','pcs'],
  },
}

function toCSVString(type: ImportType) {
  const t = TEMPLATES[type]
  if (type === 'assets') {
    return [
      t.headers.join(','),
      ['Air Compressor #5','AST-005','ACTIVE','Mechanical','Building C','Atlas Copco','GA37','SN-12345','2024-01-15','18000','50HP compressor','HIGH','2026-01-15','Full warranty on motor','hours','120.5',''].join(','),
      ['Compressor Intake Filter','AST-005-F1','ACTIVE','Mechanical','Building C','Atlas Copco','AF-22','SN-99882','2024-02-10','120','Replacement filter','MEDIUM','','','','','AST-005'].join(',')
    ].join('\n')
  }
  return [t.headers.join(','), t.example.join(',')].join('\n')
}

export default function BulkImport({ canImport = true }: { canImport?: boolean }) {
  if (!canImport) {
    return (
      <div className="max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-red-800">Import not available</p>
          <p className="text-xs text-red-600 mt-2">Technicians do not have permission to import data. Please contact an administrator or manager.</p>
        </div>
      </div>
    )
  }

  const router     = useRouter()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [type,     setType]     = useState<ImportType>('assets')
  const [file,     setFile]     = useState<File | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<ImportResult | null>(null)
  const [error,    setError]    = useState('')

  function downloadTemplate() {
    const csv  = toCSVString(type)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `import-template-${type}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res  = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Import failed'); return }
      setResult(data)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setLoading(false) }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Type selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">What would you like to import?</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['assets','parts'] as ImportType[]).map(t => (
            <button key={t} type="button" onClick={() => { setType(t); setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = '' }}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <p className={`text-sm font-semibold ${type === t ? 'text-blue-700' : 'text-gray-900'}`}>
                {t === 'assets' ? 'Assets' : 'Parts / Inventory'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t === 'assets' ? 'Import equipment and machines' : 'Import spare parts and stock'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-800">Download CSV template</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Use this template to format your data correctly. One row per {type === 'assets' ? 'asset' : 'part'}.
          </p>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary text-sm flex-shrink-0 flex items-center gap-1.5">
          <Download className="w-4 h-4" />
          Template
        </button>
      </div>

      {/* Required columns info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CSV columns</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES[type].headers.map(h => (
            <span key={h}
              className={`font-mono text-xs px-2 py-1 rounded ${
                (type === 'assets' && ['name','asset_code'].includes(h)) ||
                (type === 'parts'  && ['name','part_number'].includes(h))
                  ? 'bg-blue-100 text-blue-700 font-bold'
                  : 'bg-gray-100 text-gray-600'
              }`}>
              {h}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          <span className="bg-blue-100 text-blue-700 font-mono text-xs px-1.5 py-0.5 rounded font-bold">blue</span>
          {' '}= required. All others are optional. Existing records with the same code/number will be skipped.
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleImport} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Upload your file</h2>
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {file ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
            </div>
          ) : (
            <div>
              <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click to upload CSV file</p>
              <p className="text-xs text-gray-400 mt-1">CSV files only, max 5MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={!file || loading} className="btn-primary w-full">
          {loading ? 'Importing...' : `Import ${type}`}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Import results</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
              <p className="text-xl font-bold text-gray-900">{result.total}</p>
              <p className="text-xs text-gray-400">Rows in file</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-100 text-center">
              <p className="text-xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-gray-400">Created</p>
            </div>
            <div className={`rounded-lg p-3 border text-center ${result.skipped > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-xl font-bold ${result.skipped > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>{result.skipped}</p>
              <p className="text-xs text-gray-400">Skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-yellow-50 rounded-lg border border-yellow-100 p-3">
              <p className="text-xs font-semibold text-yellow-800 mb-2">Skipped rows:</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-xs text-yellow-700">{e}</li>
                ))}
                {result.errors.length > 10 && (
                  <li className="text-xs text-yellow-600">... and {result.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}