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
 * Resolve the domains for an asset.
 * Domains come from the asset's own many-to-many links; assets without
 * domains have none (caller falls back to global issues).
 */
export async function resolveDomainsForAsset(assetId: string): Promise<string[]> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      domains: {
        where: { domain: { isActive: true } },
        select: { domainId: true },
      },
    },
  })

  if (!asset) return []

  return asset.domains.map(d => d.domainId)
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
 * Build every active domain's issue group, plus a trailing "Common Issues"
 * (global) group. Domains whose id is in `recommendedIds` are returned first
 * and flagged so the UI can mark them as recommended for the selected asset.
 * Domains with no active issues are omitted.
 */
async function getAllDomainGroups(
  recommendedIds: Set<string> = new Set(),
  options?: GetIssuesOptions
): Promise<IssueGroup[]> {
  const [domains, globalIssues] = await Promise.all([
    prisma.maintenanceDomain.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        issues: {
          where: { issue: { isActive: true, ...(await buildIssueQuery(options)) } },
          include: { issue: true },
          orderBy: { issue: { sortOrder: 'asc' } },
        },
      },
    }),
    prisma.issue.findMany({
      where: {
        isActive: true,
        isGlobal: true,
        ...(await buildIssueQuery(options)),
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    }),
  ])

  const toGroup = (domain: (typeof domains)[number], recommended: boolean): IssueGroup => ({
    id: domain.id,
    name: domain.name,
    recommended,
    issues: domain.issues.map(l => ({
      id: l.issue.id,
      code: l.issue.code,
      title: l.issue.title,
      severity: l.issue.severity,
    })),
  })

  const withIssues = domains.filter(d => d.issues.length > 0)

  const groups: IssueGroup[] = [
    ...withIssues.filter(d => recommendedIds.has(d.id)).map(d => toGroup(d, true)),
    ...withIssues.filter(d => !recommendedIds.has(d.id)).map(d => toGroup(d, false)),
  ]

  if (globalIssues.length > 0) {
    groups.push({
      id: '__global__',
      name: 'Common Issues',
      isFallback: true,
      issues: globalIssues.map(i => ({
        id: i.id,
        code: i.code,
        title: i.title,
        severity: i.severity,
      })),
    })
  }

  return groups
}

export const IssueService = {

  /**
   * Issues for a category-scoped context. Categories are classification only
   * (no domain links), so all domains are offered without any recommendation.
   * Kept for the /api/issues?categoryId= contract (the WO form passes '').
   */
  async getIssuesForCategory(
    _categoryId: string | null | undefined,
    options?: GetIssuesOptions
  ): Promise<IssueGroup[]> {
    return getAllDomainGroups(new Set(), options)
  },

  /**
   * Resolve available issues for a given asset.
   * Returns every active domain's issues, with the asset's own linked domains
   * flagged as recommended and listed first, followed by all other domains
   * and finally common (global) issues.
   */
  async getIssuesForAsset(
    assetId: string,
    options?: GetIssuesOptions
  ): Promise<IssueGroup[]> {
    const domainIds = await resolveDomainsForAsset(assetId)
    return getAllDomainGroups(new Set(domainIds), options)
  },

  /**
   * Fallback: return global active issues when the asset has no domains.
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
   * All active issues grouped by domain, plus a "Common Issues" (global) group.
   * Used by the requester request form where there is no asset category scope.
   * When `recommendedAssetId` is provided, that asset's linked domains are
   * flagged as recommended and shown first.
   */
  async getAllIssues(
    options?: GetIssuesOptions & { recommendedAssetId?: string }
  ): Promise<IssueGroup[]> {
    const recommendedIds = new Set<string>()
    if (options?.recommendedAssetId) {
      const ids = await resolveDomainsForAsset(options.recommendedAssetId)
      ids.forEach(id => recommendedIds.add(id))
    }
    return getAllDomainGroups(recommendedIds, options)
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

    const domainIds = await resolveDomainsForAsset(assetId)
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
      issueDomainCounts,
      woLinkedIssues,
    ] = await Promise.all([
      prisma.issue.count(),
      prisma.issue.count({ where: { isActive: true } }),
      prisma.maintenanceDomain.count(),
      prisma.maintenanceDomain.count({ where: { isActive: true } }),
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
      mostUsedIssues: woLinkedIssues.map(i => ({
        id: i.id,
        code: i.code,
        title: i.title,
        workOrderCount: i._count.workOrders,
      })),
    }
  },
}
