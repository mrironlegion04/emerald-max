'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import clsx from 'clsx'

interface Tab {
  label: string
  id: string
}

const tabs: Tab[] = [
  { label: 'Overview', id: 'overview' },
  { label: 'Meters', id: 'meters' },
  { label: 'Work Orders', id: 'work-orders' },
  { label: 'History', id: 'history' },
]

export default function AssetTabs({ assetId }: { assetId: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  // If we're on a meter detail sub-route, highlight Meters tab
  const isMeterDetail = pathname.includes(`/assets/${assetId}/meters/`)
  const currentTab = isMeterDetail ? 'meters' : activeTab

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex gap-6 -mb-px">
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={`/assets/${assetId}${tab.id === 'overview' ? '' : `?tab=${tab.id}`}`}
            className={clsx(
              'pb-3 text-sm font-medium border-b-2 transition-colors',
              currentTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
