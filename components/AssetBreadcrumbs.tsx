'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface Breadcrumb {
  id: string
  name: string
  assetCode: string | null
}

interface Props {
  breadcrumbs: Breadcrumb[]
}

export default function AssetBreadcrumbs({ breadcrumbs }: Props) {
  if (breadcrumbs.length <= 1) {
    return null // Don't show if only current asset (no hierarchy)
  }

  return (
    <nav className="flex items-center gap-1 text-sm mb-4 pb-4 border-b border-gray-200">
      <Link
        href="/assets"
        className="text-gray-500 hover:text-gray-700 transition-colors"
        title="All assets"
      >
        <Home className="w-4 h-4" />
      </Link>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1

        return (
          <div key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="w-4 h-4 text-gray-300" />
            {isLast ? (
              <span className="text-gray-900 font-medium truncate">
                {crumb.name}
              </span>
            ) : (
              <Link
                href={`/assets/${crumb.id}`}
                className="text-blue-600 hover:text-blue-700 transition-colors truncate"
              >
                {crumb.name}
              </Link>
            )}
            <span className="text-xs text-gray-400 font-mono ml-1 flex-shrink-0">
              {crumb.assetCode}
            </span>
          </div>
        )
      })}
    </nav>
  )
}
