import { prisma } from '@/lib/db'

type SequenceClient = Pick<typeof prisma, 'workOrder' | 'maintenanceSchedule' | '$queryRaw' | '$executeRaw'>

/**
 * Atomically increment the counter for a given prefix and return its new value.
 * Uses `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` so concurrent
 * generators can never observe the same value.
 */
async function nextSequence(prefix: string, client: SequenceClient): Promise<number> {
  const rows = await client.$queryRaw<{ counter: number }[]>`
    INSERT INTO "number_sequences" (prefix, counter)
    VALUES (${prefix}, 1)
    ON CONFLICT (prefix) DO UPDATE SET counter = "number_sequences".counter + 1
    RETURNING counter
  `
  return Number(rows[0]?.counter ?? 0)
}

/** Raise the counter past a colliding number (manually created records). */
async function bumpSequence(prefix: string, min: number, client: SequenceClient): Promise<void> {
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
  client: SequenceClient = prisma,
  retries = 5,
): Promise<string> {
  const prefix = 'WO-'
  for (let attempt = 0; attempt < retries; attempt++) {
    const counter = await nextSequence(prefix, client)
    const candidate = `${prefix}${String(counter).padStart(4, '0')}`

    const exists = await client.workOrder.findUnique({
      where: { woNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate

    await bumpSequence(prefix, counter, client)
  }

  throw new Error('Failed to generate unique WO number after retries')
}

/**
 * Generate the next PM schedule number, e.g. `PM-0001`.
 * Uses the same atomic counter pattern as WO numbers.
 */
export async function generatePMNumber(
  client: SequenceClient = prisma,
  retries = 5,
): Promise<string> {
  const prefix = 'PM-'
  for (let attempt = 0; attempt < retries; attempt++) {
    const counter = await nextSequence(prefix, client)
    const candidate = `${prefix}${String(counter).padStart(4, '0')}`

    const exists = await client.maintenanceSchedule.findUnique({
      where: { pmNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate

    await bumpSequence(prefix, counter, client)
  }

  throw new Error('Failed to generate unique PM number after retries')
}
