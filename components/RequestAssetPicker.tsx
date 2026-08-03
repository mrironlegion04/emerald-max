'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import AssetTreeSelect from './AssetTreeSelect'

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function RequestAssetPicker({ value, onChange }: Props) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/assets')
      .then(r => (r.ok ? r.json() : []))
      .then(list => setAssets(Array.isArray(list) ? list : []))
      .catch(() => setError('Could not load assets'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="input-field w-full text-sm text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading assets...
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-rose-600">{error}</p>
  }

  return (
    <AssetTreeSelect
      assets={assets}
      value={value}
      onChange={id => onChange(id as string)}
      placeholder="Select an asset (optional)"
    />
  )
}
