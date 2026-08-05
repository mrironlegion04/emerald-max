/**
 * Asset ↔ Domain many-to-many migration — VERIFICATION.
 *
 * The one-time data migration (Asset.domainId → AssetDomain links, compound
 * domain split, source-marker strip, domain cleanup) has already run. This
 * script verifies the end state:
 *   - every non-null former domainId produced an AssetDomain link
 *   - compound domains (Mech-Elec / Hyd-Elec) no longer exist
 *   - no customFields still carry a "source" marker
 */
import { prisma } from '../lib/db'

async function main() {
  const linkCount = await prisma.assetDomain.count()
  const assetsWithLinks = await prisma.asset.count({ where: { domains: { some: {} } } })
  const assetsWithoutLinks = await prisma.asset.count({ where: { domains: { none: {} } } })
  const domains = await prisma.maintenanceDomain.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
  const compound = domains.filter(d => d.name === 'Mech-Elec' || d.name === 'Hyd-Elec')

  const withCustom = await prisma.asset.findMany({
    where: { customFields: { not: undefined } },
    select: { id: true, name: true, customFields: true },
    take: 2000,
  })
  const sourceAssets = withCustom.filter(a => {
    const cf = a.customFields as Record<string, unknown> | null
    return cf && typeof cf === 'object' && 'source' in cf
  })

  console.log('asset_domain links:', linkCount)
  console.log('assets with domain links:', assetsWithLinks, '| without:', assetsWithoutLinks)
  console.log('domains:', domains.map(d => d.name).join(', '))
  console.log('compound domains remaining:', compound.length)
  console.log('assets still carrying a "source" marker:', sourceAssets.length,
    sourceAssets.slice(0, 3).map(a => a.name).join(', '))
}

main().finally(() => prisma.$disconnect())
