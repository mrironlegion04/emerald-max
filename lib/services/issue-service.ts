import { prisma } from '@/lib/db'

export interface IssueGroup {
  id: string
  name: string
  isFallback?: boolean
  recommended?: boolean
  issues: IssueItem[]
}

export interface IssueItem {
  id: string
  code: string
  title: string
  severity: string
}

interface GetIssuesOptions {
  search?: string
}

/**
 * Resolve the category chain for an asset (its category + every ancestor up to
 * the root). Category-driven issue resolution uses this whole chain so issues
 * linked to a parent category (e.g. "Utilities") apply to child categories
 * (e.g. "Utilities → Boiler").
 */
export async function resolveCategoryChainForAsset(assetId: string): Promise<string[]> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { categoryId: true },
  })
  return resolveCategoryChain(asset?.categoryId ?? null)
}

/**
 * Resolve the category chain for a single category id, walking `parentId` up to
 * the root. Returns an empty array when no category is given.
 */
export async function resolveCategoryChain(categoryId: string | null | undefined): Promise<string[]> {
  if (!categoryId) return []

  const allCategories = await prisma.assetCategory.findMany({
    select: { id: true, parentId: true },
  })
  const byId = new Map(allCategories.map(c => [c.id, c]))

  const chain: string[] = []
  let current: string | null = categoryId
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    chain.push(current)
    current = byId.get(current)?.parentId ?? null
  }
  return chain
}

/**
 * Build the "Common Issues" fallback group from active global issues.
 */
async function getCommonIssuesGroup(options?: GetIssuesOptions): Promise<IssueGroup> {
  const issues = await prisma.issue.findMany({
    where: {
      isActive: true,
      isGlobal: true,
      ...(await buildIssueQuery(options)),
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  })

  return {
    id: '__global__',
    name: 'Common Issues',
    isFallback: true,
    issues: issues.map(i => ({
      id: i.id,
      code: i.code,
      title: i.title,
      severity: i.severity,
    })),
  }
}

async function buildIssueQuery(options?: GetIssuesOptions) {
  const search = options?.search?.trim()
  if (!search) return undefined
  return {
    OR: [
      { title: { contains: search, mode: 'insensitive' as const } },
      { code:  { contains: search, mode: 'insensitive' as const } },
    ],
  }
}

/**
 * Resolve active issues linked to any category in the chain. Deduplicated and
 * ordered by the issue's sortOrder then title.
 */
async function getIssuesForCategoryChain(
  categoryIds: string[],
  options?: GetIssuesOptions
): Promise<IssueItem[]> {
  if (categoryIds.length === 0) return []

  const links = await prisma.issueCategory.findMany({
    where: {
      categoryId: { in: categoryIds },
      issue: { isActive: true, ...(await buildIssueQuery(options)) },
    },
    include: { issue: true },
  })

  const seen = new Set<string>()
  const items: IssueItem[] = []
  for (const link of links) {
    if (seen.has(link.issueId)) continue
    seen.add(link.issueId)
    items.push({
      id: link.issue.id,
      code: link.issue.code,
      title: link.issue.title,
      severity: link.issue.severity,
    })
  }
  items.sort((a, b) => a.title.localeCompare(b.title))
  return items
}

/**
 * Resolve the leaf category name (used as the picker group label).
 */
async function getCategoryName(categoryId: string | null | undefined): Promise<string | null> {
  if (!categoryId) return null
  const category = await prisma.assetCategory.findUnique({
    where: { id: categoryId },
    select: { name: true },
  })
  return category?.name ?? null
}

async function resolveGroupForChain(
  categoryIds: string[],
  leafCategoryId: string | null | undefined,
  options?: GetIssuesOptions
): Promise<IssueGroup[]> {
  const issues = await getIssuesForCategoryChain(categoryIds, options)
  if (issues.length === 0) {
    return [await getCommonIssuesGroup(options)]
  }
  const name = (await getCategoryName(leafCategoryId)) ?? 'Category Issues'
  return [{ id: leafCategoryId ?? categoryIds[0], name, issues }]
}

export const IssueService = {

  /**
   * Issues for a category-scoped context (WO form when no asset is selected).
   * Resolves issues from the category chain; falls back to Common Issues when
   * the category has no linked issues (unknown/empty category → Common Issues).
   */
  async getIssuesForCategory(
    categoryId: string | null | undefined,
    options?: GetIssuesOptions
  ): Promise<IssueGroup[]> {
    const chain = await resolveCategoryChain(categoryId)
    return resolveGroupForChain(chain, categoryId, options)
  },

  /**
   * Resolve available issues for a given asset, based on the asset's category
   * chain (its category plus ancestors). Falls back to global Common Issues
   * when the chain has no linked issues or the asset has no category.
   */
  async getIssuesForAsset(
    assetId: string,
    options?: GetIssuesOptions
  ): Promise<IssueGroup[]> {
    const chain = await resolveCategoryChainForAsset(assetId)
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { categoryId: true },
    })
    return resolveGroupForChain(chain, asset?.categoryId, options)
  },

  /**
   * Fallback: return the global Common Issues group (used when there is no
   * category scope at all).
   */
  async getFallbackIssues(options?: GetIssuesOptions): Promise<IssueGroup[]> {
    return [await getCommonIssuesGroup(options)]
  },

  /**
   * Requester form contract (`scope=request`). When `recommendedAssetId` is
   * provided, resolves issues from that asset's category chain; otherwise
   * returns the global Common Issues group.
   */
  async getAllIssues(
    options?: GetIssuesOptions & { recommendedAssetId?: string }
  ): Promise<IssueGroup[]> {
    if (options?.recommendedAssetId) {
      return this.getIssuesForAsset(options.recommendedAssetId, options)
    }
    return [await getCommonIssuesGroup(options)]
  },

  /**
   * Validate that an issue is available for the given asset: the issue must be
   * global OR linked to a category inside the asset's category chain.
   * This is a soft check — it does not block, it just reports.
   */
  async validateIssueForAsset(
    issueId: string,
    assetId: string | null | undefined
  ): Promise<{ valid: boolean }> {
    if (!assetId) return { valid: true }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        isActive: true,
        isGlobal: true,
        categories: { select: { categoryId: true } },
      },
    })

    if (!issue || !issue.isActive) return { valid: false }
    if (issue.isGlobal) return { valid: true }

    const chain = await resolveCategoryChainForAsset(assetId)
    if (chain.length === 0) return { valid: false }

    return { valid: issue.categories.some(c => chain.includes(c.categoryId)) }
  },

  /**
   * Admin diagnostics: surface configuration gaps in the issue system.
   */
  async getDiagnostics() {
    const [
      totalIssues,
      activeIssues,
      totalCategories,
      issueCategoryCounts,
      woLinkedIssues,
    ] = await Promise.all([
      prisma.issue.count(),
      prisma.issue.count({ where: { isActive: true } }),
      prisma.assetCategory.count(),
      prisma.assetCategory.findMany({
        select: { id: true, name: true, _count: { select: { issues: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.issue.findMany({
        where: { workOrders: { some: {} } },
        select: { id: true, code: true, title: true, _count: { select: { workOrders: true } } },
        orderBy: { code: 'asc' },
        take: 20,
      }),
    ])

    const categoriesWithIssues = issueCategoryCounts.filter(c => c._count.issues > 0)
    const categoriesWithoutIssues = issueCategoryCounts.filter(c => c._count.issues === 0)
    const globalIssues = await prisma.issue.count({ where: { isGlobal: true, isActive: true } })
    const inactiveIssues = await prisma.issue.count({ where: { isActive: false } })
    const issuesUnused = await prisma.issue.count({
      where: { workOrders: { none: {} }, isActive: true },
    })

    return {
      summary: {
        totalIssues,
        activeIssues,
        inactiveIssues,
        globalIssues,
        issuesUnusedInWorkOrders: issuesUnused,
      },
      categories: {
        total: totalCategories,
        withIssues: categoriesWithIssues.length,
        withoutIssues: categoriesWithoutIssues.map(c => ({ id: c.id, name: c.name })),
      },
      mostUsedIssues: woLinkedIssues.map(i => ({
        id: i.id,
        code: i.code,
        title: i.title,
        workOrderCount: i._count.workOrders,
      })),
    }
  },
}
