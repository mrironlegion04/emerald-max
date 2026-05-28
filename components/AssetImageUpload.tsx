'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react'

interface Props {
  onImageSelect: (file: File, preview: string) => void
  currentImageUrl?: string
  assetName: string
}

export default function AssetImageUpload({ onImageSelect, currentImageUrl, assetName }: Props) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [uploading, setUploading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (5MB max for images)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setPreview(dataUrl)
      onImageSelect(file, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function handleRemove() {
    setPreview(null)
    onImageSelect({} as File, '')
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Primary asset image</label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
          {preview ? (
            <img
              src={preview}
              alt={assetName}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-400" />
          )}
        </div>

        {/* Upload controls */}
        <div className="flex-1">
          <label className="block">
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 text-sm font-medium cursor-pointer hover:bg-blue-100 transition-colors">
              <Plus className="w-4 h-4" />
              Upload image
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
          </label>

          <p className="text-xs text-gray-500 mt-2">
            JPG, PNG, GIF or WebP · Max 5MB
          </p>

          {preview && preview !== currentImageUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Remove image
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
