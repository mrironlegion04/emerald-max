'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import Badge, { assetStatusVariant } from '@/components/Badge'

interface AssetChild {
  id: string
  name: string
  assetCode: string | null
  status: string
  depth: number
  children?: AssetChild[]
}

interface Props {
  assetId: string
  children: AssetChild[]
  canEdit?: boolean
}

export default function AssetChildrenPanel({ assetId, children, canEdit }: Props) {
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

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    UNDER_MAINTENANCE: 'Under Maintenance',
    DECOMMISSIONED: 'Decommissioned',
  }

  function renderChild(child: AssetChild, depth: number = 0) {
    const hasChildren = child.children && child.children.length > 0
    const isExpanded = expandedIds.has(child.id)
    const paddingLeft = depth * 24

    return (
      <div key={child.id}>
        <div
          className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(child.id)}
              className="p-0 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />

          <Link
            href={`/assets/${child.id}`}
            className="flex-1 min-w-0 group"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                {child.name}
              </span>
              <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                {child.assetCode}
              </span>
            </div>
          </Link>

          <Badge
            label={statusLabels[child.status] || child.status}
            variant={assetStatusVariant(child.status)}
          />
        </div>

        {hasChildren && isExpanded && (
          <div>
            {child.children!.map(grandchild => renderChild(grandchild, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!children || children.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 text-sm">Sub-assets</h2>
          {canEdit && (
            <Link
              href={`/assets/new?parentId=${assetId}`}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              + Add
            </Link>
          )}
        </div>
        <p className="text-sm text-gray-500">No sub-assets</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 text-sm">
          Sub-assets ({children.length})
        </h2>
        {canEdit && (
          <Link
            href={`/assets/new?parentId=${assetId}`}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            + Add
          </Link>
        )}
      </div>
      <div className="space-y-0">
        {children.map(child => renderChild(child))}
      </div>
    </div>
  )
}
