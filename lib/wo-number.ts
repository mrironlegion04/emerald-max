import { prisma } from '@/lib/db'

const PREFIX = 'WO-'

type WoNumberClient = Pick<typeof prisma, 'workOrder' | '$queryRaw' | '$executeRaw'>

/**
 * Atomically increment the WO-number counter and return its new value.
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
 * Generate the next work order number, e.g. `WO-0001`.
 * Numbers are globally sequential (not scoped per location), and the atomic
 * counter removes the read-modify-write race.
 */
export async function generateWONumber(
  client: WoNumberClient = prisma,
  retries = 5,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const counter = await nextSequence(PREFIX, client)
    const candidate = `${PREFIX}${String(counter).padStart(4, '0')}`

    const exists = await client.workOrder.findUnique({
      where: { woNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate

    // A manually created WO already holds this number — advance the counter
    // past the collision and try again.
    await bumpSequence(PREFIX, counter, client)
  }

  throw new Error('Failed to generate unique WO number after retries')
}
