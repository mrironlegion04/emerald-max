import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge, { assetStatusVariant, workOrderStatusVariant, priorityVariant } from '@/components/Badge'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import DeleteAssetButton from '@/components/DeleteAssetButton'
import RestoreAssetButton from '@/components/RestoreAssetButton'
import QRCodeButton from '@/components/QRCodeButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import AssetPhotoDisplay from '@/components/AssetPhotoDisplay'
import AssetBreadcrumbs from '@/components/AssetBreadcrumbs'
import AssetChildrenPanel from '@/components/AssetChildrenPanel'
import AssetPartsTab from '@/components/AssetPartsTab'
import AssetTabs from '@/components/AssetTabs'
import MeterListPanel from '@/components/MeterListPanel'
import { getAssetBreadcrumbs, getAssetChildren } from '@/lib/asset-hierarchy'
import { getAssetMetrics, formatMinutes, formatDays } from '@/lib/metrics'
import { canUploadAssetAttachment, canViewAsset, canWriteToAssets, hasScopeActionFlag } from '@/lib/access-control'
import { hasPermission } from '@/lib/permissions'

function formatDate(date: Date | string | null) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(date))
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val)
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  UNDER_MAINTENANCE: 'Under Maintenance',
  DECOMMISSIONED: 'Decommissioned',
}

const woStatusLabels = WO_STATUS_LABELS

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: true,
      location: true,
      owner: { select: { id: true, name: true } },
      domains: { include: { domain: { select: { id: true, name: true } } } },
      createdBy: { select: { name: true } },
      parent: { select: { id: true, name: true, assetCode: true } },
      assetType: { select: { id: true, name: true } },
      attachments: { include: { uploadedBy: { select: { name: true } } } },
      workOrders: {
        include: {
          assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      maintenanceSchedules: {
        orderBy: { nextDueDate: 'asc' },
      },
      assetParts: {
        include: { part: { select: { name: true, partNumber: true, unitCost: true } } },
      },
    },
  })

  const allParts = await prisma.part.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, partNumber: true },
    orderBy: { name: 'asc' }
  })

  const bomTemplates = await prisma.bOMTemplate.findMany({
    select: { id: true, name: true, _count: { select: { parts: true } } },
    orderBy: { name: 'asc' }
  })

  if (!asset) notFound()

  // Plant isolation: page-level view guard (cross-plant assets render as 404)
  if (user && !(await canViewAsset(user, asset.id))) notFound()

  const canEdit = user ? await canWriteToAssets(user, [asset.id]) : false
  const canManageAssets = user ? await hasScopeActionFlag(user, 'canManageAssets') : false
  const canManageAttachments = user ? await canUploadAssetAttachment(user, asset.id) : false
  const canCreateAsset = canManageAssets && (user ? await hasPermission(user, 'asset:create') : false)
  const canEditAsset = canManageAssets && (user ? await hasPermission(user, 'asset:edit') : false)
  const canEditWO = user ? (await hasScopeActionFlag(user, 'canEditWO')) && (await hasPermission(user, 'wo:create')) : false

  // Parts usage history: find WOs linked to this asset, then their parts
  const assetWOIds = await prisma.workOrderAsset.findMany({
    where: { assetId: id },
    select: { workOrderId: true },
  })
  const partsUsage = await prisma.workOrderPart.findMany({
    where: { workOrderId: { in: assetWOIds.map(w => w.workOrderId) } },
    include: {
      part: { select: { id: true, name: true, partNumber: true, unit: true, unitCost: true } },
      workOrder: { select: { id: true, woNumber: true, title: true, status: true, completedAt: true, createdAt: true } },
    },
    orderBy: { workOrder: { createdAt: 'desc' } },
  })

  const totalPartsValue = asset.assetParts.reduce(
    (sum, ap) => sum + ap.expectedQuantity * Number(ap.part.unitCost ?? 0), 0
  )
  const totalPartsUsedQty = partsUsage.reduce((s, p) => s + p.quantity, 0)
  const totalPartsUsedCost = partsUsage.reduce(
    (s, p) => s + p.quantity * Number(p.unitCost ?? p.part.unitCost ?? 0), 0
  )

  const metrics = await getAssetMetrics(id)

  const isDeleted = asset.isDeleted

  // Build category breadcrumb path by walking parent chain
  let categoryPath = ''
  if (asset.category) {
    const allCategories = await prisma.assetCategory.findMany({
      select: { id: true, name: true, parentId: true },
    })
    const crumbs: string[] = []
    let cur: { id: string; name: string; parentId: string | null } | undefined = asset.category
    while (cur) {
      crumbs.unshift(cur.name)
      cur = cur.parentId ? allCategories.find((c: { id: string; name: string; parentId: string | null }) => c.id === cur!.parentId) : undefined
    }
    categoryPath = crumbs.join(' › ')
  }

  // Build location breadcrumb path
  let locationPath = ''
  if (asset.location) {
    const allLocations = await prisma.location.findMany({
      select: { id: true, name: true, parentId: true },
    })
    const crumbs: string[] = []
    let cur: { id: string; name: string; parentId: string | null } | undefined = asset.location
    while (cur) {
      crumbs.unshift(cur.name)
      cur = cur.parentId ? allLocations.find((l: { id: string; name: string; parentId: string | null }) => l.id === cur!.parentId) : undefined
    }
    locationPath = crumbs.join(' › ')
  }

  // Fetch breadcrumbs and children
  const breadcrumbs = await getAssetBreadcrumbs(id)
  const children = await getAssetChildren(id)

  const openWOs = asset.workOrders.filter((w: { status: string }) =>
    ['OPEN', 'IN_PROGRESS', 'ON_HOLD'].includes(w.status)
  ).length

  const totalLaborCost = asset.workOrders.reduce((sum: number, w) => sum + Number(w.laborCost ?? 0), 0)
  const totalPartsCost = asset.workOrders.reduce((sum: number, w) => sum + Number(w.partsCost ?? 0), 0)

  const activeTab = (await searchParams)?.tab || 'overview'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-1">
        <Link href="/assets" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to assets
        </Link>
      </div>

      {/* Breadcrumbs */}
      <AssetBreadcrumbs breadcrumbs={breadcrumbs} />

      {/* Deleted banner */}
      {isDeleted && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700">This asset has been deleted</p>
            <p className="text-xs text-red-600 mt-0.5">
              Deleted on {asset.deletedAt ? formatDate(asset.deletedAt) : 'Unknown date'}
              — it is hidden from active views but all historical data is preserved.
            </p>
          </div>
          <RestoreAssetButton assetId={asset.id} />
        </div>
      )}

      <PageHeader
        title={asset.name}
        subtitle={`${asset.assetCode}${asset.manufacturer ? ` · ${asset.manufacturer}` : ''}${asset.model ? ` ${asset.model}` : ''}`}
        action={
          isDeleted ? (
            <div className="flex gap-2">
              <QRCodeButton assetId={asset.id} assetCode={asset.assetCode} assetName={asset.name} />
            </div>
          ) : (
            <div className="flex gap-2">
              <QRCodeButton assetId={asset.id} assetCode={asset.assetCode} assetName={asset.name} />
              {canCreateAsset && (
                <Link href={`/assets/new?parentId=${asset.id}`} className="btn-secondary text-sm">
                  + Add sub-asset
                </Link>
              )}
              {canEditAsset && (
                <Link href={`/assets/${asset.id}/edit`} className="btn-secondary text-sm">
                  Edit asset
                </Link>
              )}
              {canEditWO && (
                <Link href={`/work-orders/new?assetId=${asset.id}`} className="btn-primary text-sm">
                  + New work order
                </Link>
              )}
            </div>
          )
        }
      />

      <AssetTabs assetId={asset.id} />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: asset info */}
          <div className="lg:col-span-1 space-y-5">
            {/* Photo */}
            <AssetPhotoDisplay
              assetId={asset.id}
              assetName={asset.name}
              imageUrl={asset.imageUrl}
            />

            {/* Status + quick stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-sm">Status</h2>
                <Badge
                  label={statusLabels[asset.status] ?? asset.status}
                  variant={assetStatusVariant(asset.status)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Open WOs</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{openWOs}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Total WOs</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{asset.workOrders.length}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Labor cost</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(totalLaborCost)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Parts cost</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(totalPartsCost)}</p>
                </div>
              </div>
            </div>

            {/* Maintenance Metrics */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-1">Maintenance Metrics</h2>
              <p className="text-[11px] text-gray-400 mb-3">Failure metrics track breakdown work orders only; repair activity includes all completed work.</p>
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1">Failure metrics (breakdowns)</p>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">MTTR (Repair Time)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {metrics.totalFailures > 0 && metrics.totalRepairTime === 0 ? 'Not recorded' : metrics.mttr > 0 ? formatMinutes(metrics.mttr) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">Avg Downtime (Asset Unavailable)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {metrics.avgDowntime > 0 ? formatMinutes(metrics.avgDowntime) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">MTBF (Mean Time Between Failures)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {metrics.mtbf > 0 ? formatDays(metrics.mtbf) : '—'}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                  <span className="text-xs text-gray-600">Total Failures</span>
                  <span className="text-sm font-semibold text-gray-900">{metrics.totalFailures}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">Last Failure</span>
                  <span className="text-xs text-gray-600">{formatDate(metrics.lastFailureDate)}</span>
                </div>

                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-2 border-t border-gray-100">Repair activity (all completed work)</p>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">Total Downtime</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {metrics.totalDowntimeMinutes > 0 ? formatMinutes(metrics.totalDowntimeMinutes) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">Total Repair Time</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {metrics.totalRepairTime > 0 ? formatMinutes(metrics.totalRepairTime) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-gray-600">Last Repair</span>
                  <span className="text-xs text-gray-600">{formatDate(metrics.lastRepairDate)}</span>
                </div>
              </div>
            </div>
            {asset.parent && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 text-sm mb-3">Parent asset</h2>
                <Link
                  href={`/assets/${asset.parent.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                      {asset.parent.name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {asset.parent.assetCode}
                    </p>
                  </div>
                </Link>
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Details</h2>
              <dl className="space-y-3">
                {([
                  { label: 'Asset code',    value: asset.assetCode },
                  { label: 'Asset type',    value: asset.assetType?.name ?? null },
                  { label: 'Category',      value: categoryPath || null },
                  { label: 'Industrial Domains', value: null },
                  { label: 'Serial number', value: asset.serialNumber },
                  { label: 'Manufacturer',  value: asset.manufacturer },
                  { label: 'Model',         value: asset.model },
                  { label: 'Location',      value: locationPath || asset.location?.name || null },
                  { label: 'Owner',         value: asset.owner?.name },
                  { label: 'Criticality',   value: asset.criticality },
                  { label: 'Purchase date', value: formatDate(asset.purchaseDate) },
                  { label: 'Purchase cost', value: asset.purchaseCost != null ? formatCurrency(Number(asset.purchaseCost)) : null },
                  { label: 'Created by',    value: asset.createdBy?.name },
                ] as { label: string; value: string | null | undefined }[]).map(row => (
                  <div key={row.label} className="flex justify-between gap-4">
                    <dt className="text-xs text-gray-400 flex-shrink-0">{row.label}</dt>
                    <dd className="text-xs font-medium text-right truncate max-w-[60%]">
                      {row.label === 'Location' && locationPath ? (
                        <span className="text-emerald-700">{locationPath}</span>
                      ) : row.label === 'Category' && categoryPath ? (
                        <span className="text-indigo-700">{categoryPath}</span>
                      ) : row.label === 'Industrial Domains' && asset.domains && asset.domains.length > 0 ? (
                        <span className="inline-flex flex-wrap gap-1 justify-end">
                          {asset.domains.map(d => (
                            <span key={d.domain.id} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-semibold">
                              {d.domain.name}
                            </span>
                          ))}
                        </span>
                      ) : row.label === 'Asset type' && (asset.assetType?.name) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                          {asset.assetType?.name}
                        </span>
                      ) : row.label === 'Criticality' && asset.criticality ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          asset.criticality === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          asset.criticality === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          asset.criticality === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {asset.criticality.charAt(0) + asset.criticality.slice(1).toLowerCase()}
                        </span>
                      ) : (
                        <span className="text-gray-900">{row.value || '—'}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Description */}
            {asset.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 text-sm mb-2">Description</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{asset.description}</p>
              </div>
            )}

            {/* Custom fields */}
            {asset.customFields && Object.keys(asset.customFields).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 text-sm mb-3">Custom attributes</h2>
                <dl className="space-y-2">
                  {Object.entries(asset.customFields).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <dt className="text-xs text-gray-400">{key}</dt>
                      <dd className="text-xs text-gray-900 font-medium text-right">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* PM Schedules */}
            {asset.maintenanceSchedules.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 text-sm mb-3">PM schedules</h2>
                <div className="space-y-2">
                  {asset.maintenanceSchedules.map((pm: any) => {
                    const isOverdue = new Date(pm.nextDueDate) < new Date()
                    return (
                      <div key={pm.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">{pm.title}</p>
                          <Badge
                            label={pm.isActive ? 'Active' : 'Inactive'}
                            variant={pm.isActive ? 'green' : 'gray'}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Every {pm.interval} {pm.frequency.toLowerCase()}
                        </p>
                        <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                          Next: {formatDate(pm.nextDueDate)} {isOverdue ? '· OVERDUE' : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Danger zone — soft-delete only, hidden for already-deleted assets */}
            {canEdit && !isDeleted && (
              <div className="bg-white rounded-xl border border-red-100 p-5">
                <h2 className="font-semibold text-red-700 text-sm mb-2">Archive asset</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Archiving hides this asset from active views but preserves all work orders, metrics, and history.
                </p>
                <DeleteAssetButton assetId={asset.id} assetName={asset.name} />
              </div>
            )}
          </div>

          {/* Right: work order history and attachments */}
          <div className="lg:col-span-2 space-y-5">
            {/* Children */}
            <AssetChildrenPanel assetId={asset.id} children={children} canEdit={canEdit} />

            {/* Attachments */}
            <AttachmentsPanel
              attachments={asset.attachments.map((a: any) => ({
                ...a,
                uploadedBy: a.uploadedBy?.name || null,
              }))}
              entityType="asset"
              entityId={asset.id}
              canEdit={canManageAttachments}
            />

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">
                  Work order history
                  <span className="ml-2 text-gray-400 font-normal">({asset.workOrders.length})</span>
                </h2>
                <Link
                  href={`/work-orders/new?assetId=${asset.id}`}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  + New WO
                </Link>
              </div>
              {asset.workOrders.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  No work orders for this asset yet
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {asset.workOrders.map((wo: any) => (
                    <Link
                      key={wo.id}
                      href={`/work-orders/${wo.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {wo.woNumber}
                          {wo.assignedTo ? ` · ${wo.assignedTo.name}` : ''}
                          {wo.dueDate ? ` · Due ${formatDate(wo.dueDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
                        <Badge
                          label={woStatusLabels[wo.status] ?? wo.status}
                          variant={workOrderStatusVariant(wo.status)}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'parts' && (
        <AssetPartsTab
          assetId={asset.id}
          assetParts={asset.assetParts.map(ap => ({
            ...ap,
            part: { ...ap.part, unitCost: ap.part.unitCost != null ? Number(ap.part.unitCost) : null },
          }))}
          allParts={allParts}
          bomTemplates={bomTemplates}
          partsUsage={partsUsage.map(pu => ({
            ...pu,
            unitCost: pu.unitCost != null ? Number(pu.unitCost) : null,
            part: { ...pu.part, unitCost: pu.part.unitCost != null ? Number(pu.part.unitCost) : null },
          }))}
          totalPartsValue={totalPartsValue}
          totalPartsUsedQty={totalPartsUsedQty}
          totalPartsUsedCost={totalPartsUsedCost}
          canEdit={canEdit}
        />
      )}

      {activeTab === 'meters' && (
        <MeterListPanel assetId={asset.id} />
      )}

      {activeTab === 'work-orders' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              Work orders
              <span className="ml-2 text-gray-400 font-normal">({asset.workOrders.length})</span>
            </h2>
            <Link
              href={`/work-orders/new?assetId=${asset.id}`}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              + New WO
            </Link>
          </div>
          {asset.workOrders.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              No work orders for this asset yet
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {asset.workOrders.map((wo: any) => (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {wo.woNumber}
                      {wo.assignedTo ? ` · ${wo.assignedTo.name}` : ''}
                      {wo.dueDate ? ` · Due ${formatDate(wo.dueDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
                    <Badge
                      label={woStatusLabels[wo.status] ?? wo.status}
                      variant={workOrderStatusVariant(wo.status)}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-5">
          <AttachmentsPanel
            attachments={asset.attachments.map((a: any) => ({
              ...a,
              uploadedBy: a.uploadedBy?.name || null,
            }))}
            entityType="asset"
            entityId={asset.id}
            canEdit={canManageAttachments}
          />
        </div>
      )}
    </div>
  )
}
