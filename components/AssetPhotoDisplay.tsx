'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Image as ImageIcon, Trash2 } from 'lucide-react'

interface Props {
  assetId: string
  assetName: string
  imageUrl?: string | null
  onPhotoRemoved?: () => void
}

export default function AssetPhotoDisplay({ assetId, assetName, imageUrl, onPhotoRemoved }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleRemove() {
    if (!confirm('Remove this photo?')) return

    setDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/assets/${assetId}/photo`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to remove photo')
        setDeleting(false)
        return
      }

      onPhotoRemoved?.()
      // Refresh the page to show updated state
      router.refresh()
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Asset photo</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs mb-3">
          {error}
        </div>
      )}

      {imageUrl ? (
        <div className="space-y-3">
          <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={assetName}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={handleRemove}
            disabled={deleting}
            className="flex items-center gap-2 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Removing...' : 'Remove photo'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <ImageIcon className="w-12 h-12 mb-2" />
          <p className="text-sm">No photo yet</p>
          <p className="text-xs text-gray-500 mt-1">Add a photo by editing the asset</p>
        </div>
      )}
    </div>
  )
}
