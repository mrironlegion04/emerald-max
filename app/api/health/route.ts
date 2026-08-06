import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      uptime: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'down',
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : 'unknown error',
      },
      { status: 503 }
    )
  }
}
