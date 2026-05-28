'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import Badge, { assetStatusVariant } from '@/components/Badge'

interface AssetWithCount {
  id: string
  name: string
  assetCode: string
  status: string
  category?: { id: string; name: string } | null
  location?: { id: string; name: string } | null
  _count: { workOrders: number; children: number }
}

interface Props {
  assets: AssetWithCount[]
  canEdit: boolean
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  UNDER_MAINTENANCE: 'Under Maintenance',
  DECOMMISSIONED: 'Decommissioned',
}

export default function AssetHierarchyTable({ assets, canEdit }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  function renderAssetRow(asset: AssetWithCount, depth: number = 0) {
    const hasChildren = asset._count.children > 0
    const isExpanded = expandedIds.has(asset.id)
    const paddingLeft = depth * 32

    return (
      <div key={asset.id}>
        <div
          className="flex items-center gap-2 py-3 px-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(asset.id)}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          {/* Asset icon */}
          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />

          {/* Asset link */}
          <Link
            href={`/assets/${asset.id}`}
            className="flex-1 min-w-0 group"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                {asset.name}
              </span>
              <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                {asset.assetCode}
              </span>
            </div>
          </Link>

          {/* Category and Location */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            <span className="text-xs text-gray-500 truncate max-w-[150px]">
              {asset.category?.name || '—'}
            </span>
            <span className="text-xs text-gray-500 truncate max-w-[150px]">
              {asset.location?.name || '—'}
            </span>
          </div>

          {/* Work orders count */}
          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            {asset._count.workOrders > 0 && (
              <span className="text-gray-600 font-medium">
                {asset._count.workOrders} WO{asset._count.workOrders !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Status badge */}
          <Badge
            label={statusLabels[asset.status] || asset.status}
            variant={assetStatusVariant(asset.status)}
          />

          {/* Children badge */}
          {hasChildren && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium flex-shrink-0">
              {asset._count.children} child{asset._count.children !== 1 ? 'ren' : ''}
            </span>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {/* Fetch and render children - for now they won't be shown without fetching */}
            {/* This component would need to be refactored to support async children loading */}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 py-3 px-4 bg-gray-50 border-b border-gray-200">
        <div className="flex-1 text-xs font-semibold text-gray-700">Asset</div>
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-700 max-w-[150px]">Category</div>
          <div className="text-xs font-semibold text-gray-700 max-w-[150px]">Location</div>
        </div>
        <div className="text-xs font-semibold text-gray-700 flex-shrink-0">Work Orders</div>
        <div className="text-xs font-semibold text-gray-700 flex-shrink-0">Status</div>
      </div>

      {/* Rows */}
      <div>
        {assets.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No root assets found
          </div>
        ) : (
          assets.map(asset => renderAssetRow(asset))
        )}
      </div>
    </div>
  )
}
