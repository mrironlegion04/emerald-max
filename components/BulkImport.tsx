'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Download, UploadCloud, CheckCircle2 } from 'lucide-react'

type ImportType = 'assets' | 'parts' | 'work_orders' | 'locations' | 'maintwiz_assets'

interface ImportResult {
  created: number; skipped: number; errors: string[]; total: number
  summary?: Record<string, number | string[]>
  ownerPasswords?: { email: string; password: string }[]
  dryRun?: boolean
  preview?: { code: string; name: string; [k: string]: string }[]
}

const PREVIEW_TYPES: ImportType[] = ['locations', 'maintwiz_assets']

const TYPE_LABELS: Record<ImportType, { title: string; subtitle: string }> = {
  assets:          { title: 'Assets', subtitle: 'Import equipment and machines' },
  parts:           { title: 'Parts / Inventory', subtitle: 'Import spare parts and stock' },
  work_orders:     { title: 'Work Orders', subtitle: 'Import maintenance work orders' },
  locations:       { title: 'Locations', subtitle: 'Facilities & plant hierarchy (MaintWiz)' },
  maintwiz_assets: { title: 'MaintWiz Equipment', subtitle: 'Import equipment from a MaintWiz export' },
}

const REQUIRED: Partial<Record<ImportType, string[]>> = {
  assets:          ['name', 'asset_code'],
  parts:           ['name', 'part_number'],
  work_orders:     ['title'],
  locations:       ['Facility Code'],
  maintwiz_assets: ['Equipment Name', 'Equipment code'],
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
  work_orders: {
    headers: ['title','description','type','priority','status','due_date','assigned_to','asset_code','category'],
    example: ['Replace compressor belt','Belt showing wear on unit 5','PREVENTIVE','HIGH','OPEN','2025-02-01','tech@cmms.com','AST-005','Mechanical'],
  },
  locations: {
    headers: ['Facility Name','Facility Code','Part of Facility','Description','Type'],
    example: ['IndustrialPneumaticTyres','ETL-GPD-IPT','EmeraldGummidipoondiPlant','IndustrialPneumaticTyres','Facility'],
  },
  maintwiz_assets: {
    headers: ['Equipment Name','Facility Name','Facility code','Part of Equipment','Equipment code','Description','Group','Equipment Class','Engineering Group','Sub Group','Criticality','Equipment Load','Owner','Equipment Status','Parent Equipment','Machine Status','eqpmAttribute1','Last WO Date','SM Description','Next Schedule Date','Equipment Image','Approved By','Approved Time'],
    example: ['Curing Press 1','SRT mould','ETL-GPD-SRT-MLD','','CUR-PRE-001','50T hydraulic curing press','Curing press','AMC','Mechanical','Hydraulic press','HIGH','','Manikandan','Production','No','ON','','','','','No','',''],
  },
}

const SUMMARY_LABELS: Record<string, string> = {
  assets: 'Rows in file',
  newAssets: 'Assets to create',
  locations: 'Facilities',
  missingLocations: 'Missing locations',
  categories: 'Categories (groups)',
  newCategories: 'Categories to create',
  subcategories: 'Sub-categories',
  newSubcategories: 'Sub-categories to create',
  domains: 'Domains',
  newDomains: 'Domains to create',
  owners: 'Owners',
  newOwners: 'Owner accounts to create',
  existingLocations: 'Already in app',
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
  const [preview,  setPreview]  = useState<ImportResult | null>(null)
  const [error,    setError]    = useState('')

  const isPreviewType = PREVIEW_TYPES.includes(type)

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

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true); setError(''); setResult(null); setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      fd.append('dryRun', 'true')
      const res  = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Preview failed'); return }
      setPreview(data)
    } catch { setError('Network error') }
    finally  { setLoading(false) }
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
      setPreview(null)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setLoading(false) }
  }

  function SummaryGrid({ summary }: { summary: Record<string, number | string[]> }) {
    const entries = Object.entries(summary).filter(([k]) => SUMMARY_LABELS[k])
    if (entries.length === 0) return null
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {entries.map(([k, v]) => (
          <div key={k} className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-lg font-bold text-gray-900">{String(v)}</p>
            <p className="text-xs text-gray-400">{SUMMARY_LABELS[k]}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Type selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">What would you like to import?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys(TEMPLATES) as ImportType[]).map(t => (
            <button key={t} type="button" onClick={() => { setType(t); setFile(null); setResult(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <p className={`text-sm font-semibold ${type === t ? 'text-blue-700' : 'text-gray-900'}`}>
                {TYPE_LABELS[t].title}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{TYPE_LABELS[t].subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-800">Download CSV template</p>
          <p className="text-xs text-blue-600 mt-0.5">
            {isPreviewType
              ? 'MaintWiz export format. Upload the file as-is — fields are matched by column name.'
              : `Use this template to format your data correctly. One row per ${type === 'assets' ? 'asset' : type === 'parts' ? 'part' : 'work order'}.`}
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
                REQUIRED[type]?.includes(h) ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-100 text-gray-600'
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
      <form onSubmit={isPreviewType ? handlePreview : handleImport} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setPreview(null) }} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={!file || loading} className="btn-primary w-full">
          {loading
            ? (isPreviewType ? 'Analyzing...' : 'Importing...')
            : isPreviewType
              ? 'Preview & validate'
              : `Import ${type === 'work_orders' ? 'work orders' : TYPE_LABELS[type].title.toLowerCase()}`}
        </button>
      </form>

      {/* Dry-run preview */}
      {preview && !result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Preview — nothing written yet</h2>
          </div>
          {preview.summary && <SummaryGrid summary={preview.summary} />}

          {preview.preview && preview.preview.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">First rows</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-500">
                      {Object.keys(preview.preview[0]).map(k => (
                        <th key={k} className="px-3 py-2 font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} className="px-3 py-2 text-gray-700">{v || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="bg-yellow-50 rounded-lg border border-yellow-100 p-3 mb-4">
              <p className="text-xs font-semibold text-yellow-800 mb-2">Warnings:</p>
              <ul className="space-y-1">
                {preview.errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-xs text-yellow-700">{e}</li>
                ))}
                {preview.errors.length > 10 && (
                  <li className="text-xs text-yellow-600">... and {preview.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleImport} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Importing...' : 'Confirm & import'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="btn-secondary flex-shrink-0">
              Cancel
            </button>
          </div>
        </div>
      )}

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
          {result.summary && <SummaryGrid summary={result.summary} />}

          {result.ownerPasswords && result.ownerPasswords.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-100 p-3 mb-4">
              <p className="text-xs font-semibold text-blue-800 mb-2">
                New owner accounts created — share these temporary passwords (change required):
              </p>
              <ul className="space-y-1">
                {result.ownerPasswords.map((o, i) => (
                  <li key={i} className="text-xs text-blue-700 font-mono">
                    {o.email} &nbsp;/&nbsp; {o.password}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
