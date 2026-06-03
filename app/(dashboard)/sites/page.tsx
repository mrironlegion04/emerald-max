import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { Layers, ClipboardList, AlertTriangle, AlertCircle, DollarSign } from 'lucide-react'

function fmtc(v: number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v) }

export default async function SitesPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      parentId: true,
      assets: {
        include: {
          workOrders: {
            select: { status: true, priority: true, dueDate: true, laborCost: true, partsCost: true },
          },
        },
      },
    },
  })

  // Also get unassigned (no location)
  const unassignedAssets = await prisma.asset.findMany({
    where: { isDeleted: false, locationId: null },
    include: {
      workOrders: {
        select: { status: true, priority: true, dueDate: true, laborCost: true, partsCost: true },
      },
    },
  })

  // Recursive helper to get all sub-location IDs under a location (including itself)
  function getDescendantIds(locId: string, allLocs: typeof locations): string[] {
    const ids = [locId]
    const children = allLocs.filter((l: any) => l.parentId === locId)
    for (const child of children) {
      ids.push(...getDescendantIds(child.id, allLocs))
    }
    return ids
  }

  const buildSiteStats = (assets: any) => {
    const allWOs = assets.flatMap((a: any) => a.workOrders)
    const now    = new Date()
    return {
      assetCount:     assets.length,
      activeAssets:   assets.filter((a: any) => a.status === 'ACTIVE').length,
      openWOs:        allWOs.filter((w: any) => ['OPEN','IN_PROGRESS'].includes(w.status)).length,
      overdueWOs:     allWOs.filter((w: any) => ['OPEN','IN_PROGRESS'].includes(w.status) && w.dueDate && new Date(w.dueDate) < now).length,
      criticalWOs:    allWOs.filter((w: any) => w.priority === 'CRITICAL' && ['OPEN','IN_PROGRESS'].includes(w.status)).length,
      completedWOs:   allWOs.filter((w: any) => w.status === 'COMPLETED').length,
      totalCost:      allWOs.filter((w: any) => w.status === 'COMPLETED').reduce((s: number, w: any) => s + (w.laborCost??0) + (w.partsCost??0), 0),
    }
  }

  const parentLocations = locations.filter((loc: any) => !loc.parentId)

  const sites = [
    ...parentLocations.map((loc: any) => {
      const descendantIds = getDescendantIds(loc.id, locations)
      const combinedAssets = locations
        .filter((l: any) => descendantIds.includes(l.id))
        .flatMap((l: any) => l.assets)

      return {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        ...buildSiteStats(combinedAssets)
      }
    }),
    ...(unassignedAssets.length > 0 ? [{ id: 'unassigned', name: 'No location', address: null, ...buildSiteStats(unassignedAssets) }] : []),
  ]

  const totals = {
    assets:    sites.reduce((s: number, l: any) => s + l.assetCount, 0),
    openWOs:   sites.reduce((s: number, l: any) => s + l.openWOs, 0),
    overdue:   sites.reduce((s: number, l: any) => s + l.overdueWOs, 0),
    critical:  sites.reduce((s: number, l: any) => s + l.criticalWOs, 0),
    cost:      sites.reduce((s: number, l: any) => s + l.totalCost, 0),
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Sites overview" subtitle="Maintenance KPIs broken down by location." />

      {/* Fleet totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
        {[
          { label: 'Total assets',   value: totals.assets,            color: 'text-blue-700', bg: 'bg-blue-50/70', border: 'border-blue-100/40', icon: Layers, iconColor: 'text-blue-600' },
          { label: 'Open WOs',       value: totals.openWOs,           color: 'text-amber-700', bg: 'bg-amber-50/70', border: 'border-amber-100/40', icon: ClipboardList, iconColor: 'text-amber-600' },
          { label: 'Overdue',        value: totals.overdue,           color: totals.overdue > 0 ? 'text-red-700' : 'text-green-700', bg: totals.overdue > 0 ? 'bg-rose-50/70' : 'bg-emerald-50/70', border: totals.overdue > 0 ? 'border-rose-100/40' : 'border-emerald-100/40', icon: AlertTriangle, iconColor: totals.overdue > 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Critical open',  value: totals.critical,          color: totals.critical > 0 ? 'text-rose-700' : 'text-slate-700', bg: totals.critical > 0 ? 'bg-rose-10/70 shadow-3xs' : 'bg-slate-50/70', border: totals.critical > 0 ? 'border-rose-100/30' : 'border-slate-100', icon: AlertCircle, iconColor: totals.critical > 0 ? 'text-rose-600' : 'text-slate-500' },
          { label: 'Total maint. cost', value: fmtc(totals.cost),    color: 'text-purple-700', bg: 'bg-purple-50/70', border: 'border-purple-100/40', icon: DollarSign, iconColor: 'text-purple-600' },
        ].map((s: any) => (
          <div key={s.label} className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition-all duration-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.025)]">
            <div className={`w-10 h-10 border rounded-xl flex items-center justify-center flex-shrink-0 shadow-3xs ${s.bg} ${s.border}`}>
              <s.icon className={`w-5 h-5 ${s.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider truncate" title={s.label}>{s.label}</p>
              <p className={`text-lg sm:text-2xl font-bold tracking-tight mt-0.5 leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-1">all sites</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-site cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {sites.map((site: any) => (
          <div key={site.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{site.name}</h3>
                {site.address && <p className="text-xs text-gray-400 mt-0.5">{site.address}</p>}
              </div>
              <div className="flex gap-1.5">
                {site.criticalWOs > 0 && <Badge label={`${site.criticalWOs} critical`} variant="red" />}
                {site.overdueWOs > 0  && <Badge label={`${site.overdueWOs} overdue`}  variant="yellow" />}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-gray-900">{site.assetCount}</p>
                <p className="text-xs text-gray-400">assets</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className={`text-xl font-bold ${site.openWOs > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{site.openWOs}</p>
                <p className="text-xs text-gray-400">open WOs</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xl font-bold text-green-700">{site.completedWOs}</p>
                <p className="text-xs text-gray-400">completed</p>
              </div>
            </div>

            {/* Mini progress bar: active assets */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Active assets</span>
                <span>{site.activeAssets}/{site.assetCount}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-green-500"
                  style={{ width: site.assetCount > 0 ? `${Math.round(site.activeAssets/site.assetCount*100)}%` : '0%' }} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400">Maintenance cost</p>
                <p className="text-sm font-bold text-purple-700">{fmtc(site.totalCost)}</p>
              </div>
              {site.id !== 'unassigned' && (
                <Link href={`/assets?locationId=${site.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                  View assets →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {sites.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400">
          No locations configured. <Link href="/settings/locations" className="text-blue-600 hover:underline">Add locations</Link> to see site breakdown.
        </div>
      )}
    </div>
  )
}