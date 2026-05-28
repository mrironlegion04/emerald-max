import { prisma } from '../lib/db'

async function buildPath(id: string): Promise<string> {
  const crumbs: string[] = []
  let current: { id: string; name: string; parentId: string | null } | null =
    await prisma.location.findUnique({ where: { id }, select: { id: true, name: true, parentId: true } })

  while (current) {
    crumbs.unshift(current.name)
    current = current.parentId
      ? await prisma.location.findUnique({
          where: { id: current.parentId },
          select: { id: true, name: true, parentId: true },
        })
      : null
  }
  return crumbs.join(' › ')
}

async function main() {
  const locations = await prisma.location.findMany({ select: { id: true } })
  console.log(`Backfilling paths for ${locations.length} location(s)...`)
  for (const loc of locations) {
    const path = await buildPath(loc.id)
    await prisma.location.update({ where: { id: loc.id }, data: { path } })
    console.log(' ✓', path)
  }
  console.log('Done.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
