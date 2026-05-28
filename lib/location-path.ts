import { prisma } from '@/lib/db'

type LocationRow = { id: string; name: string; parentId: string | null }

/**
 * Walk the parent chain and build a breadcrumb path string.
 * e.g. "Plant A › Building 2 › Line 3"
 */
export async function buildLocationPath(
  parentId: string | null,
  ownName: string
): Promise<string> {
  const ancestors: string[] = []

  let currentParentId: string | null = parentId
  while (currentParentId) {
    const row: LocationRow | null = await prisma.location.findUnique({
      where: { id: currentParentId },
      select: { id: true, name: true, parentId: true },
    })
    if (!row) break
    ancestors.unshift(row.name)
    currentParentId = row.parentId
  }

  return [...ancestors, ownName].join(' › ')
}

/**
 * After renaming or reparenting a location, update its cached path
 * and refresh all immediate children's paths (one level deep).
 */
export async function refreshLocationPaths(locationId: string): Promise<void> {
  const loc: LocationRow | null = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, parentId: true },
  })
  if (!loc) return

  const newPath = await buildLocationPath(loc.parentId, loc.name)
  await prisma.location.update({
    where: { id: locationId },
    data: { path: newPath },
  })

  // Refresh immediate children
  const children = await prisma.location.findMany({
    where: { parentId: locationId },
    select: { id: true, name: true },
  })

  for (const child of children) {
    await prisma.location.update({
      where: { id: child.id },
      data: { path: `${newPath} › ${child.name}` },
    })
  }
}
