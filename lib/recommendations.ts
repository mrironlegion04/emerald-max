import { prisma } from '@/lib/db'
import { resolveDomains } from '@/lib/services/issue-service'

export interface RecommendationTeam {
  id: string
  name: string
  trade: string | null
}

export interface AssetRecommendations {
  assetId: string
  domains: { id: string; name: string }[]
  team: RecommendationTeam | null
  teams: RecommendationTeam[]
  owner: { id: string; name: string } | null
  criticality: string | null
}

/**
 * Resolve smart suggestions for a work-order/request targeting an asset:
 *  - the maintenance team(s) responsible for the asset's domain(s)
 *  - the asset owner as the recommended individual assignee
 *  - the asset criticality as a priority hint
 */
export async function getAssetRecommendations(assetId: string): Promise<AssetRecommendations> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      domainId: true,
      criticality: true,
      owner: { select: { id: true, name: true, isActive: true } },
      categoryId: true,
    },
  })

  const empty: AssetRecommendations = {
    assetId,
    domains: [],
    team: null,
    teams: [],
    owner: null,
    criticality: null,
  }
  if (!asset) return empty

  const domainIdSet = new Set<string>()
  if (asset.domainId) domainIdSet.add(asset.domainId)
  if (asset.categoryId) {
    const viaCategory = await resolveDomains(asset.categoryId)
    viaCategory.forEach(id => domainIdSet.add(id))
  }

  const domains = await prisma.maintenanceDomain.findMany({
    where: { id: { in: [...domainIdSet] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  let team: RecommendationTeam | null = null
  let teams: RecommendationTeam[] = []
  if (domainIdSet.size > 0) {
    const links = await prisma.teamDomain.findMany({
      where: {
        domainId: { in: [...domainIdSet] },
        team: { isActive: true, isDeleted: false },
      },
      select: {
        domainId: true,
        team: { select: { id: true, name: true, trade: true } },
      },
      orderBy: { team: { name: 'asc' } },
    })

    const byTeam = new Map<string, RecommendationTeam>()
    let directMatch: RecommendationTeam | null = null
    for (const link of links) {
      if (!byTeam.has(link.team.id)) {
        byTeam.set(link.team.id, { id: link.team.id, name: link.team.name, trade: link.team.trade })
      }
      if (asset.domainId && link.domainId === asset.domainId && !directMatch) {
        directMatch = { id: link.team.id, name: link.team.name, trade: link.team.trade }
      }
    }
    teams = [...byTeam.values()]
    team = directMatch ?? teams[0] ?? null
  }

  return {
    assetId,
    domains,
    team,
    teams,
    owner: asset.owner && asset.owner.isActive ? { id: asset.owner.id, name: asset.owner.name } : null,
    criticality: asset.criticality ?? null,
  }
}
