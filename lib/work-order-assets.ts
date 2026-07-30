import { prisma } from '@/lib/db'

export type WOScope = 'SINGLE_ASSET' | 'MULTI_ASSET' | 'LOCATION_GENERAL' | 'LOCATION_ALL_ASSETS'

export interface AssetEntry {
  assetId: string
  source: 'DIRECT' | 'LOCATION_SCOPE'
}

export interface NormalizedAssets {
  scope: WOScope
  assetId: string | null
  entries: AssetEntry[]
}

/**
 * Determine the WO scope from raw input and produce the normalized
 * assetId + WorkOrderAsset entries.
 *
 * Rules:
 *   SINGLE_ASSET    → assetId set, 1 entry (source=DIRECT)
 *   MULTI_ASSET     → assetId null, N entries (source=DIRECT)
 *   LOCATION_GENERAL → assetId null, 0 entries
 *   LOCATION_ALL_ASSETS → assetId null, N entries (source=LOCATION_SCOPE)
 */
export async function normalizeWorkOrderAssets(
  assetId: string | null | undefined,
  selectedAssetIds: string[] | undefined,
  locationId: string | null | undefined,
  locationScope: string | null | undefined,
): Promise<NormalizedAssets> {
  const hasAssetSelection = !!(assetId || (selectedAssetIds && selectedAssetIds.length > 0))
  const isGeneral = !!locationId && locationScope === 'GENERAL'
  const isAllAssets = !!locationId && locationScope === 'ALL_ASSETS'

  // Asset-based types take priority over location scope
  if (hasAssetSelection) {
    const allIds = [
      ...(assetId ? [assetId] : []),
      ...(selectedAssetIds ?? []),
    ]
    const unique = [...new Set(allIds)]

    if (unique.length === 1) {
      return {
        scope: 'SINGLE_ASSET',
        assetId: unique[0],
        entries: [{ assetId: unique[0], source: 'DIRECT' }],
      }
    }

    return {
      scope: 'MULTI_ASSET',
      assetId: null,
      entries: unique.map(id => ({ assetId: id, source: 'DIRECT' })),
    }
  }

  // LOCATION_GENERAL — no assets, location-only ticket
  if (isGeneral) {
    return { scope: 'LOCATION_GENERAL', assetId: null, entries: [] }
  }

  // LOCATION_ALL_ASSETS — snapshot all descendant location assets
  if (isAllAssets) {
    const entries = await resolveLocationAssets(locationId!)
    return { scope: 'LOCATION_ALL_ASSETS', assetId: null, entries }
  }

  // Fallback — no assets, no location (shouldn't happen)
  return { scope: 'LOCATION_GENERAL', assetId: null, entries: [] }
}

/**
 * Resolve ALL assets (including sub-assets recursively) for a location.
 * Flattens the hierarchy into a single list.
 */
async function resolveLocationAssets(locationId: string): Promise<AssetEntry[]> {
  const allLocations = await prisma.location.findMany({
    select: { id: true, parentId: true },
  })

  function getDescendantLocationIds(locId: string): string[] {
    const ids = [locId]
    const children = allLocations.filter(l => l.parentId === locId)
    for (const child of children) {
      ids.push(...getDescendantLocationIds(child.id))
    }
    return ids
  }

  const allLocationIds = getDescendantLocationIds(locationId)

  const allAssets = await prisma.asset.findMany({
    select: { id: true, name: true, parentId: true, locationId: true },
  })

  // Filter assets assigned to this location or sub-locations
  const locationSeedAssets = allAssets.filter(
    a => a.locationId && allLocationIds.includes(a.locationId),
  )
  const seedIds = new Set(locationSeedAssets.map(a => a.id))

  // Find top-level parent assets in this location context
  const topLevelParents = locationSeedAssets.filter(
    a => !a.parentId || !seedIds.has(a.parentId),
  )

  // Trace downward recursively to find all sub-assets
  const traced: string[] = []
  const visited = new Set<string>()

  function traceDescendants(asset: typeof allAssets[0]) {
    if (visited.has(asset.id)) return
    visited.add(asset.id)
    traced.push(asset.id)
    const children = allAssets
      .filter(a => a.parentId === asset.id)
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const child of children) traceDescendants(child)
  }

  topLevelParents.sort((a, b) => a.name.localeCompare(b.name))
  for (const parent of topLevelParents) {
    traceDescendants(parent)
  }

  return traced.map(id => ({ assetId: id, source: 'LOCATION_SCOPE' }))
}

/**
 * Sync WorkOrderAsset records in the database.
 * Removes stale entries, adds new ones.
 */
export async function syncWorkOrderAssets(
  workOrderId: string,
  entries: AssetEntry[],
): Promise<void> {
  const existing = await prisma.workOrderAsset.findMany({
    where: { workOrderId },
    select: { assetId: true, source: true },
  })
  const existingMap = new Map(existing.map(e => [e.assetId, e.source]))

  const incomingMap = new Map(entries.map(e => [e.assetId, e]))

  const toRemove = [...existingMap.keys()].filter(id => !incomingMap.has(id))

  const toAdd = entries.filter(e => !existingMap.has(e.assetId))

  if (toRemove.length > 0) {
    await prisma.workOrderAsset.deleteMany({
      where: { workOrderId, assetId: { in: toRemove } },
    })
  }

  if (toAdd.length > 0) {
    await prisma.workOrderAsset.createMany({
      data: toAdd.map(e => ({
        workOrderId,
        assetId: e.assetId,
        source: e.source,
      })),
    })
  }

  // Update source for existing entries that changed
  for (const [assetId, source] of existingMap) {
    const incoming = incomingMap.get(assetId)
    if (incoming && incoming.source !== source) {
      await prisma.workOrderAsset.update({
        where: { workOrderId_assetId: { workOrderId, assetId } },
        data: { source: incoming.source },
      })
    }
  }
}
