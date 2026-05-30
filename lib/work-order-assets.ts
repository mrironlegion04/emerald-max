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
 * Collect relevant checklist templates for a set of assets and (optionally) a location.
 */
export async function resolveTemplatesForAssets(
  assetIds: string[],
  locationId?: string | null,
): Promise<{ templateId: string; assetId: string; source: 'ASSET' | 'CATEGORY' | 'LOCATION' }[]> {
  if (assetIds.length === 0) return []

  // 1. Batch load all assets to fetch their categoryId to avoid N+1 lookups
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, categoryId: true },
  })

  const assetCategoryMap = new Map<string, string | null>(
    assets.map(a => [a.id, a.categoryId])
  )

  const categoryIds = [...new Set(assets.map(a => a.categoryId).filter((id): id is string => !!id))]

  // 2. Load all ChecklistTemplates that are directly attached to these assets
  const templateAssets = await prisma.checklistTemplate.findMany({
    where: {
      assets: { some: { id: { in: assetIds } } },
    },
    select: {
      id: true,
      assets: { select: { id: true } },
    },
  })

  // 3. Load all ChecklistTemplates attached to these categories
  const templateCategories = categoryIds.length > 0
    ? await prisma.checklistTemplate.findMany({
        where: {
          categories: { some: { id: { in: categoryIds } } },
        },
        select: {
          id: true,
          categories: { select: { id: true } },
        },
      })
    : []

  // 4. Load all ChecklistTemplates attached to the location (if provided)
  const templateLocations = locationId
    ? await prisma.checklistTemplate.findMany({
        where: {
          locations: { some: { id: locationId } },
        },
        select: { id: true },
      })
    : []

  const locTemplateIds = templateLocations.map(t => t.id)

  const result: { templateId: string; assetId: string; source: 'ASSET' | 'CATEGORY' | 'LOCATION' }[] = []

  // For each asset, resolve its templates independently with correct source prioritization:
  // ASSET (highest) > CATEGORY > LOCATION (lowest)
  for (const assetId of assetIds) {
    const resolvedForAsset = new Map<string, 'ASSET' | 'CATEGORY' | 'LOCATION'>()

    // Priority 1: Direct Asset Templates
    const directTemplates = templateAssets.filter(t => t.assets.some(a => a.id === assetId))
    for (const t of directTemplates) {
      resolvedForAsset.set(t.id, 'ASSET')
    }

    // Priority 2: Category Templates
    const catId = assetCategoryMap.get(assetId)
    if (catId) {
      const catTemplates = templateCategories.filter(t => t.categories.some(c => c.id === catId))
      for (const t of catTemplates) {
        if (!resolvedForAsset.has(t.id)) {
          resolvedForAsset.set(t.id, 'CATEGORY')
        }
      }
    }

    // Priority 3: Location Templates
    for (const tid of locTemplateIds) {
      if (!resolvedForAsset.has(tid)) {
        resolvedForAsset.set(tid, 'LOCATION')
      }
    }

    // Add resolved asset-template mappings
    for (const [templateId, source] of resolvedForAsset.entries()) {
      result.push({ templateId, assetId, source })
    }
  }

  return result
}

/**
 * Generate per-asset checklists from templates.
 * Creates one WOChecklist per asset-template pair, with items preserving assetId.
 * Duplicate prevention: skips if same template already applied to same asset, ensuring idempotency.
 */
export async function generatePerAssetChecklists(
  workOrderId: string,
  templateMappings: { templateId: string; assetId: string; source: string }[],
  checklistSource: string = 'AUTO_TEMPLATE',
): Promise<void> {
  if (templateMappings.length === 0) return

  const templateIds = [...new Set(templateMappings.map(m => m.templateId))]

  // Batch load all ChecklistTemplates and their items
  const templates = await prisma.checklistTemplate.findMany({
    where: { id: { in: templateIds } },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  const templateMap = new Map(templates.map(t => [t.id, t]))

  // Batch load all unique Asset names
  const assetIds = [...new Set(templateMappings.map(m => m.assetId).filter((id): id is string => !!id))]
  const assets = assetIds.length > 0
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, name: true },
      })
    : []
  const assetNameMap = new Map<string, string>(assets.map(a => [a.id, a.name]))

  // Deduplicate mappings to prevent duplicate checklist generation in the same batch
  const uniqueMappings: { templateId: string; assetId: string; source: string }[] = []
  const seenBatchKeys = new Set<string>()
  for (const mapping of templateMappings) {
    const key = `${mapping.assetId ?? 'null'}-${mapping.templateId}`
    if (!seenBatchKeys.has(key)) {
      seenBatchKeys.add(key)
      uniqueMappings.push(mapping)
    }
  }

  // Load existing checklists for this work order to prevent duplicate generation (Requirement 6)
  const existingChecklists = await prisma.wOChecklist.findMany({
    where: { workOrderId },
    select: { title: true, source: true },
  })
  const existingTitles = new Set(existingChecklists.map(c => c.title))

  for (const mapping of uniqueMappings) {
    const template = templateMap.get(mapping.templateId)
    if (!template || template.items.length === 0) continue

    const assetName = mapping.assetId ? assetNameMap.get(mapping.assetId) : null
    const title = assetName ? `${assetName} — ${template.name}` : template.name

    // Skip if already generated (Requirement 6)
    if (existingTitles.has(title)) {
      continue
    }

    const checklist = await prisma.wOChecklist.create({
      data: {
        workOrderId,
        title,
        source: checklistSource,
      },
    })

    await prisma.wOChecklistItem.createMany({
      data: template.items.map(item => ({
        checklistId: checklist.id,
        label: item.label,
        type: item.type,
        isMandatory: item.isMandatory,
        sortOrder: item.sortOrder,
        options: item.options,
        isChecked: false,
        assetId: mapping.assetId || null,
      })),
    })
  }
}

/**
 * Automatically generates MaintainX-style checklists for a work order based on its assets,
 * adhering to the MaintainX checklist generation rules.
 */
export async function generateAutoChecklistsForWorkOrder(
  workOrderId: string,
  assetIds: string[],
  locationScope?: string | null,
): Promise<void> {
  const finalLocationScope = locationScope ?? (await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { locationScope: true },
  }))?.locationScope

  if (finalLocationScope === 'GENERAL' || assetIds.length === 0) {
    return
  }

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { locationId: true },
  })
  const locationId = wo?.locationId

  // 1. Resolve templates for all assetIds
  const templateMappings = await resolveTemplatesForAssets(assetIds, locationId)

  // 2. Generate checklists
  await generatePerAssetChecklists(workOrderId, templateMappings, 'AUTO_TEMPLATE')
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

  const incomingMap = new Map(entries.map((e: AssetEntry) => [e.assetId, e]))

  const toRemove = [...existingMap.keys()].filter((id: string) => !incomingMap.has(id))

  const toAdd = entries.filter((e: AssetEntry) => !existingMap.has(e.assetId))

  if (toRemove.length > 0) {
    await prisma.workOrderAsset.deleteMany({
      where: { workOrderId, assetId: { in: toRemove } },
    })
  }

  if (toAdd.length > 0) {
    await prisma.workOrderAsset.createMany({
      data: toAdd.map((e: AssetEntry) => ({
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
