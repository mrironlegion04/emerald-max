import { prisma } from '@/lib/db'

export interface AssetNode {
  id: string
  name: string
  assetCode: string | null
  status: string
  depth: number
  children?: AssetNode[]
}

/**
 * Check if setting parentId on an asset would create a circular reference
 */
export async function checkCircularReference(assetId: string, parentId: string): Promise<boolean> {
  if (assetId === parentId) return true

  // Traverse up the parent chain of the potential parent
  let currentId: string | null = parentId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) break // Safety: prevent infinite loops
    visited.add(currentId)

    if (currentId === assetId) {
      return true // Circular reference detected
    }

    const result: { parentId: string | null } | null = await prisma.asset.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    })

    currentId = result?.parentId ?? null
  }

  return false
}

/**
 * Get the full breadcrumb path for an asset (root → ... → current)
 */
export async function getAssetBreadcrumbs(
  assetId: string
): Promise<Array<{ id: string; name: string; assetCode: string | null }>> {
  const breadcrumbs: Array<{ id: string; name: string; assetCode: string | null }> = []
  let currentId: string | null = assetId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) break // Safety: prevent infinite loops
    visited.add(currentId)

    const result: { id: string; name: string; assetCode: string | null; parentId: string | null } | null = await prisma.asset.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, assetCode: true, parentId: true },
    })

    if (!result) break

    breadcrumbs.unshift({
      id: result.id,
      name: result.name,
      assetCode: result.assetCode,
    })
    currentId = result.parentId
  }

  return breadcrumbs
}

/**
 * Get all children of an asset (recursively)
 */
export async function getAssetChildren(
  parentId: string,
  depth: number = 0
): Promise<AssetNode[]> {
  const children = await prisma.asset.findMany({
    where: { isDeleted: false, parentId },
    select: {
      id: true,
      name: true,
      assetCode: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  })

  // Recursively fetch children's children
  const result = await Promise.all(
    children.map(async (child) => {
      const node: AssetNode = {
        id: child.id,
        name: child.name,
        assetCode: child.assetCode,
        status: child.status,
        depth: depth + 1,
        children: await getAssetChildren(child.id, depth + 1),
      }
      return node
    })
  )

  return result
}

/**
 * Get root assets only (parentId is null)
 */
export async function getRootAssets(filters?: {
  search?: string
  status?: string
  categoryId?: string
  locationId?: string
}) {
  const where: Record<string, unknown> = {
    isDeleted: false,
    parentId: null,
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { assetCode: { contains: filters.search, mode: 'insensitive' } },
      { serialNumber: { contains: filters.search, mode: 'insensitive' } },
      { manufacturer: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters?.status) where.status = filters.status
  if (filters?.categoryId) where.categoryId = filters.categoryId
  if (filters?.locationId) where.locationId = filters.locationId

  return prisma.asset.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      _count: { select: { workOrders: true, children: true } },
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Get asset with full hierarchy tree
 */
export async function getAssetWithTree(assetId: string) {
  const result = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: true,
      location: true,
      parent: { select: { id: true, name: true, assetCode: true } },
      _count: { select: { children: true } },
    },
  })

  if (!result) return null

  // Get children recursively
  const children = await getAssetChildren(assetId)

  return { ...result, children }
}
