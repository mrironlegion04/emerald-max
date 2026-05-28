'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Trees, List } from 'lucide-react'

type ViewMode = 'hierarchy' | 'all'

interface Props {
  currentView: ViewMode
}

export default function AssetViewToggle({ currentView }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleViewChange(newView: ViewMode) {
    const params = new URLSearchParams(searchParams)
    if (newView === 'all') {
      params.set('view', 'all')
    } else {
      params.delete('view') // 'hierarchy' is the default
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="inline-flex items-center border border-gray-200 rounded-lg p-0.5 bg-white">
        <button
          onClick={() => handleViewChange('hierarchy')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            currentView === 'hierarchy'
              ? 'bg-blue-50 text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Show root assets with hierarchy"
        >
          <Trees className="w-4 h-4" />
          Hierarchy
        </button>
        <button
          onClick={() => handleViewChange('all')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            currentView === 'all'
              ? 'bg-blue-50 text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Show all assets in flat list"
        >
          <List className="w-4 h-4" />
          All assets
        </button>
      </div>
      <span className="text-xs text-gray-400">
        {currentView === 'hierarchy' ? 'Root assets with children count' : 'Flat list of all assets'}
      </span>
    </div>
  )
}
