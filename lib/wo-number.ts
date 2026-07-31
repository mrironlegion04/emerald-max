import { prisma } from '@/lib/db'

type WoNumberClient = Pick<typeof prisma, 'workOrder' | 'location'>

const DEFAULT_PREFIX = 'GLB'

/** Uppercase + strip unsafe chars; fall back to GLB when unset */
export function sanitizeLocationCode(code: string | null | undefined): string {
  const cleaned = (code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 6)
  return cleaned || DEFAULT_PREFIX
}

/** Resolve the WO number prefix for a location (falls back to GLB). */
export async function getLocationCode(
  locationId: string | null | undefined,
  client: WoNumberClient = prisma,
): Promise<string> {
  if (!locationId) return DEFAULT_PREFIX
  const loc = await client.location.findUnique({
    where: { id: locationId },
    select: { code: true },
  })
  return sanitizeLocationCode(loc?.code)
}

/**
 * Generate the next work order number for a location, e.g. `A-WO-0001`.
 * Sequences are per-prefix, so every plant starts at `{CODE}-WO-0001`.
 * Retries on collision to stay race-safe; numbers remain globally unique
 * because the prefix is part of the value.
 */
export async function generateWONumber(
  locationId: string | null | undefined,
  client: WoNumberClient = prisma,
  retries = 5,
): Promise<string> {
  const code = await getLocationCode(locationId, client)
  const prefix = `${code}-WO-`

  for (let attempt = 0; attempt < retries; attempt++) {
    const last = await client.workOrder.findFirst({
      where: { woNumber: { startsWith: prefix } },
      orderBy: { woNumber: 'desc' },
      select: { woNumber: true },
    })

    let next = 1
    if (last?.woNumber) {
      const num = parseInt(last.woNumber.slice(prefix.length), 10)
      if (!isNaN(num)) next = num + 1
    }

    const candidate = `${prefix}${String(next).padStart(4, '0')}`
    const exists = await client.workOrder.findUnique({
      where: { woNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }

  throw new Error('Failed to generate unique WO number after retries')
}
