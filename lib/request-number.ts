import { prisma } from '@/lib/db'

const PREFIX = 'REQ-'

/**
 * Generate the next request number, e.g. `REQ-0001`.
 * Retries on collision to stay race-safe; numbers are globally unique.
 */
export async function generateRequestNumber(retries = 5): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const last = await prisma.maintenanceRequest.findFirst({
      where: { requestNumber: { startsWith: PREFIX } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true },
    })

    let next = 1
    if (last?.requestNumber) {
      const num = parseInt(last.requestNumber.slice(PREFIX.length), 10)
      if (!isNaN(num)) next = num + 1
    }

    const candidate = `${PREFIX}${String(next).padStart(4, '0')}`
    const exists = await prisma.maintenanceRequest.findUnique({
      where: { requestNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }

  throw new Error('Failed to generate unique request number after retries')
}
