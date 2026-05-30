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
  if (assetIds.length === 0 && !locationId) return []

  const assets = assetIds.length > 0
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, categoryId: true },
      })
    : []

  const categoryIds = [...new Set(assets.map(a => a.categoryId).filter((id): id is string => !!id))]

  const templateAssets = assetIds.length > 0
    ? await prisma.checklistTemplate.findMany({
        where: { assets: { some: { id: { in: assetIds } } } },
        select: { id: true, assets: { select: { id: true } } },
      })
    : []

  const templateCategories = categoryIds.length > 0
    ? await prisma.checklistTemplate.findMany({
        where: { categories: { some: { id: { in: categoryIds } } } },
        select: { id: true, categories: { select: { id: true } } },
      })
    : []

  const templateLocations = locationId
    ? await prisma.checklistTemplate.findMany({
        where: { locations: { some: { id: locationId } } },
        select: { id: true },
      })
    : []

  const result: { templateId: string; assetId: string; source: 'ASSET' | 'CATEGORY' | 'LOCATION' }[] = []

  const seen = new Set<string>()

  for (const t of templateAssets) {
    for (const a of t.assets) {
      const key = `${t.id}-${a.id}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ templateId: t.id, assetId: a.id, source: 'ASSET' })
      }
    }
  }

  for (const t of templateCategories) {
    for (const c of t.categories) {
      const matchedAssets = assets.filter(a => a.categoryId === c.id)
      for (const a of matchedAssets) {
        const key = `${t.id}-${a.id}`
        if (!seen.has(key)) {
          seen.add(key)
          result.push({ templateId: t.id, assetId: a.id, source: 'CATEGORY' })
        }
      }
    }
  }

  const locTemplateIds = new Set(templateLocations.map(t => t.id))

  if (locationId) {
    for (const assetId of assetIds) {
      for (const tid of locTemplateIds) {
        const key = `${tid}-${assetId}`
        if (!seen.has(key)) {
          seen.add(key)
          result.push({ templateId: tid, assetId, source: 'LOCATION' })
        }
      }
    }
  }

  return result
}

/**
 * Generate per-asset checklists from templates.
 * Creates one WOChecklist per asset-template pair, with items preserving assetId.
 * Duplicate prevention: skips if same template already applied to same asset.
 */
export async function generatePerAssetChecklists(
  workOrderId: string,
  templateMappings: { templateId: string; assetId: string; source: string }[],
): Promise<void> {
  if (templateMappings.length === 0) return

  const templateIds = [...new Set(templateMappings.map(m => m.templateId))]

  const templates = await prisma.checklistTemplate.findMany({
    where: { id: { in: templateIds } },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  const templateMap = new Map(templates.map(t => [t.id, t]))

  // Group mappings by template
  const byTemplate = new Map<string, { assetId: string; source: string }[]>()
  for (const m of templateMappings) {
    if (!byTemplate.has(m.templateId)) byTemplate.set(m.templateId, [])
    byTemplate.get(m.templateId)!.push(m)
  }

  for (const [templateId, mappings] of byTemplate) {
    const template = templateMap.get(templateId)
    if (!template || template.items.length === 0) continue

    // Deduplicate by asset
    const seenAssets = new Set<string>()
    const uniqueMappings = mappings.filter(m => {
      if (seenAssets.has(m.assetId)) return false
      seenAssets.add(m.assetId)
      return true
    })

    // Create one checklist per asset (this template + this asset)
    for (const mapping of uniqueMappings) {
      const asset = await prisma.asset.findUnique({
        where: { id: mapping.assetId },
        select: { name: true },
      })
      if (!asset) continue

      const checklist = await prisma.wOChecklist.create({
        data: {
          workOrderId,
          title: `${asset.name} — ${template.name}`,
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
          assetId: mapping.assetId,
        })),
      })
    }
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
  // Rule 1: General Maintenance (location-only): do not generate checklist
  if (locationScope === 'GENERAL' || assetIds.length === 0) {
    return
  }

  // Iterate over each asset independently
  for (const assetId of assetIds) {
    if (!assetId) continue

    // 1. Load asset name and categoryId
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { name: true, categoryId: true },
    })
    if (!asset) continue

    // 2. Load ChecklistTemplates directly attached to the asset
    const assetTemplates = await prisma.checklistTemplate.findMany({
      where: {
        assets: { some: { id: assetId } },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    // 3. Load ChecklistTemplates attached to the asset's category
    const categoryTemplates = asset.categoryId
      ? await prisma.checklistTemplate.findMany({
          where: {
            categories: { some: { id: asset.categoryId } },
          },
          include: {
            items: { orderBy: { sortOrder: 'asc' } },
          },
        })
      : []

    // 4. Merge and deduplicate based on Priority: Asset-attached first, then category-attached.
    const uniqueTemplatesMap = new Map<string, typeof assetTemplates[0]>()
    
    // Add asset-attached templates (higher priority)
    for (const t of assetTemplates) {
      if (t.items.length > 0) {
        uniqueTemplatesMap.set(t.id, t)
      }
    }

    // Add category-attached templates if not already present
    for (const t of categoryTemplates) {
      if (t.items.length > 0 && !uniqueTemplatesMap.has(t.id)) {
        uniqueTemplatesMap.set(t.id, t)
      }
    }

    // 5. Generate checklist instances for that asset
    const templatesToApply = Array.from(uniqueTemplatesMap.values())
    for (const template of templatesToApply) {
      // Create a checklist instance
      const checklist = await prisma.wOChecklist.create({
        data: {
          workOrderId,
          title: `${asset.name} — ${template.name}`,
        },
      })

      // Generate items preserving assetId
      await prisma.wOChecklistItem.createMany({
        data: template.items.map((item: any) => ({
          checklistId: checklist.id,
          label: item.label,
          type: item.type,
          isMandatory: item.isMandatory,
          sortOrder: item.sortOrder,
          options: item.options,
          isChecked: false,
          assetId: assetId,
        })),
      })
    }
  }
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
  const existingMap = new Map(existing.map((e: any) => [e.assetId, e.source]))

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
