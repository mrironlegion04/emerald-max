import { prisma } from '@/lib/db'

export interface IssueGroup {
  id: string
  name: string
  isFallback?: boolean
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
 * Walk up the category parent chain (max 10 levels) and return the domain IDs
 * of the nearest ancestor (including self) that has active domains assigned.
 */
export async function resolveDomains(startCategoryId: string): Promise<string[]> {
  const chain: string[] = []
  let currentId: string | null = startCategoryId

  while (currentId && chain.length < 10) {
    chain.push(currentId)
    const row = await prisma.assetCategory.findUnique({
      where:  { id: currentId },
      select: { parentId: true },
    }) as { parentId: string | null } | null
    currentId = row?.parentId ?? null
  }

  if (chain.length === 0) return []

  const links = await prisma.categoryDomain.findMany({
    where: {
      categoryId: { in: chain },
      domain: { isActive: true },
    },
    select: { categoryId: true, domainId: true },
  })

  const map = new Map<string, string[]>()
  for (const link of links) {
    const existing = map.get(link.categoryId) ?? []
    existing.push(link.domainId)
    map.set(link.categoryId, existing)
  }

  for (const id of chain) {
    const domains = map.get(id)
    if (domains && domains.length > 0) return domains
  }

  return []
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

export const IssueService = {

  /**
   * Resolve available issues for a given category through its domain chain.
   *
   * Priority:
   *   1. Category/domain issues (with parent inheritance)
   *   2. Global issues (fallback when no domains configured)
   *   3. OTHER is always available in the frontend
   */
  async getIssuesForCategory(
    categoryId: string | null | undefined,
    options?: GetIssuesOptions
  ): Promise<IssueGroup[]> {
    if (!categoryId) {
      return this.getFallbackIssues(options)
    }

    const domainIds = await resolveDomains(categoryId)

    if (domainIds.length === 0) {
      return this.getFallbackIssues(options)
    }

    const domains = await prisma.maintenanceDomain.findMany({
      where: {
        id: { in: domainIds },
        isActive: true,
      },
      orderBy: { name: 'asc' },
      include: {
        issues: {
          where: {
            issue: {
              isActive: true,
              ...(await buildIssueQuery(options)),
            },
          },
          include: { issue: true },
          orderBy: { issue: { sortOrder: 'asc' } },
        },
      },
    })

    const totalIssues = domains.reduce((sum, d) => sum + d.issues.length, 0)
    if (totalIssues === 0) {
      return this.getFallbackIssues(options)
    }

    const groups: IssueGroup[] = domains.map(d => ({
      id: d.id,
      name: d.name,
      issues: d.issues.map(i => ({
        id: i.issue.id,
        code: i.issue.code,
        title: i.issue.title,
        severity: i.issue.severity,
      })),
    }))

    return groups
  },

  /**
   * Resolve available issues for a given asset (resolves its category first).
   */
  async getIssuesForAsset(
    assetId: string,
    options?: GetIssuesOptions
  ): Promise<IssueGroup[]> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { categoryId: true },
    })
    return this.getIssuesForCategory(asset?.categoryId, options)
  },

  /**
   * Fallback: return global active issues when no domains are configured
   * for the asset's category.
   */
  async getFallbackIssues(options?: GetIssuesOptions): Promise<IssueGroup[]> {
    const issues = await prisma.issue.findMany({
      where: {
        isActive: true,
        isGlobal: true,
        ...(await buildIssueQuery(options)),
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    })

    return [{
      id: '__global__',
      name: 'Common Issues',
      isFallback: true,
      issues: issues.map(i => ({
        id: i.id,
        code: i.code,
        title: i.title,
        severity: i.severity,
      })),
    }]
  },

  /**
   * Validate that an issue is available for the given asset.
   * Returns valid=true if the issue is in the resolved set.
   * This is a soft check — it does not block, it just reports.
   */
  async validateIssueForAsset(
    issueId: string,
    assetId: string | null | undefined
  ): Promise<{ valid: boolean }> {
    if (!assetId) return { valid: true }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { categoryId: true },
    })

    if (!asset?.categoryId) {
      const issue = await prisma.issue.findFirst({
        where: { id: issueId, isActive: true, isGlobal: true },
      })
      return { valid: !!issue }
    }

    const domainIds = await resolveDomains(asset.categoryId)
    if (domainIds.length === 0) {
      const issue = await prisma.issue.findFirst({
        where: { id: issueId, isActive: true, isGlobal: true },
      })
      return { valid: !!issue }
    }

    // Domains exist but have no active issues → fall back to global check
    const activeIssueCount = await prisma.issueDomain.count({
      where: {
        domainId: { in: domainIds },
        issue: { isActive: true },
      },
    })
    if (activeIssueCount === 0) {
      const issue = await prisma.issue.findFirst({
        where: { id: issueId, isActive: true, isGlobal: true },
      })
      return { valid: !!issue }
    }

    const link = await prisma.issueDomain.findFirst({
      where: {
        issueId,
        domainId: { in: domainIds },
        issue: { isActive: true },
      },
    })

    return { valid: !!link }
  },

  /**
   * Admin diagnostics: surface configuration gaps in the issue system.
   */
  async getDiagnostics() {
    const [
      totalIssues,
      activeIssues,
      totalDomains,
      activeDomains,
      categoriesWithDomains,
      totalCategories,
      issueDomainCounts,
      woLinkedIssues,
    ] = await Promise.all([
      prisma.issue.count(),
      prisma.issue.count({ where: { isActive: true } }),
      prisma.maintenanceDomain.count(),
      prisma.maintenanceDomain.count({ where: { isActive: true } }),
      prisma.categoryDomain.groupBy({ by: ['categoryId'] }).then(r => r.length),
      prisma.assetCategory.count(),
      prisma.maintenanceDomain.findMany({
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

    const domainsWithIssues = issueDomainCounts.filter(d => d._count.issues > 0)
    const domainsWithoutIssues = issueDomainCounts.filter(d => d._count.issues === 0)
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
      domains: {
        total: totalDomains,
        active: activeDomains,
        withIssues: domainsWithIssues.length,
        withoutIssues: domainsWithoutIssues.map(d => ({ id: d.id, name: d.name })),
      },
      categories: {
        total: totalCategories,
        withDomains: categoriesWithDomains,
        withoutDomains: totalCategories - categoriesWithDomains,
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
