import { prisma } from '@/lib/db'

type WoNumberClient = Pick<typeof prisma, 'workOrder' | 'location' | '$queryRaw' | '$executeRaw'>

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
 * Atomically increment the per-prefix counter and return its new value.
 * Uses `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` so concurrent
 * generators can never observe the same value.
 */
async function nextSequence(prefix: string, client: WoNumberClient): Promise<number> {
  const rows = await client.$queryRaw<{ counter: number }[]>`
    INSERT INTO "number_sequences" (prefix, counter)
    VALUES (${prefix}, 1)
    ON CONFLICT (prefix) DO UPDATE SET counter = "number_sequences".counter + 1
    RETURNING counter
  `
  return Number(rows[0]?.counter ?? 0)
}

/** Raise the counter past a colliding number (manually created records). */
async function bumpSequence(prefix: string, min: number, client: WoNumberClient): Promise<void> {
  await client.$executeRaw`
    UPDATE "number_sequences" SET counter = GREATEST(counter, ${min + 1}) WHERE prefix = ${prefix}
  `
}

/**
 * Generate the next work order number for a location, e.g. `A-WO-0001`.
 * Sequences are per-prefix, so every plant starts at `{CODE}-WO-0001`.
 * Numbers remain globally unique because the prefix is part of the value,
 * and the atomic counter removes the read-modify-write race.
 */
export async function generateWONumber(
  locationId: string | null | undefined,
  client: WoNumberClient = prisma,
  retries = 5,
): Promise<string> {
  const code = await getLocationCode(locationId, client)
  const prefix = `${code}-WO-`

  for (let attempt = 0; attempt < retries; attempt++) {
    const counter = await nextSequence(prefix, client)
    const candidate = `${prefix}${String(counter).padStart(4, '0')}`

    const exists = await client.workOrder.findUnique({
      where: { woNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate

    // A manually created WO already holds this number — advance the counter
    // past the collision and try again.
    await bumpSequence(prefix, counter, client)
  }

  throw new Error('Failed to generate unique WO number after retries')
}
