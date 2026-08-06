import { prisma } from '@/lib/db'

const PREFIX = 'REQ-'

type RequestNumberClient = Pick<typeof prisma, 'maintenanceRequest' | '$queryRaw' | '$executeRaw'>

/** Atomically increment the request-number counter and return its new value. */
async function nextSequence(prefix: string, client: RequestNumberClient): Promise<number> {
  const rows = await client.$queryRaw<{ counter: number }[]>`
    INSERT INTO "number_sequences" (prefix, counter)
    VALUES (${prefix}, 1)
    ON CONFLICT (prefix) DO UPDATE SET counter = "number_sequences".counter + 1
    RETURNING counter
  `
  return Number(rows[0]?.counter ?? 0)
}

/** Raise the counter past a colliding number (manually created records). */
async function bumpSequence(prefix: string, min: number, client: RequestNumberClient): Promise<void> {
  await client.$executeRaw`
    UPDATE "number_sequences" SET counter = GREATEST(counter, ${min + 1}) WHERE prefix = ${prefix}
  `
}

/**
 * Generate the next request number, e.g. `REQ-0001`.
 * The atomic counter makes concurrent generation race-safe.
 */
export async function generateRequestNumber(
  client: RequestNumberClient = prisma,
  retries = 5,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const counter = await nextSequence(PREFIX, client)
    const candidate = `${PREFIX}${String(counter).padStart(4, '0')}`

    const exists = await client.maintenanceRequest.findUnique({
      where: { requestNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate

    // A manually created request already holds this number — advance the
    // counter past the collision and try again.
    await bumpSequence(PREFIX, counter, client)
  }

  throw new Error('Failed to generate unique request number after retries')
}
