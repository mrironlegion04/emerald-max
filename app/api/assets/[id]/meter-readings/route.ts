import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

/**
 * Backward-compatibility shim for the old single-meter-per-asset API.
 * Proxies to the primary meter on the asset.
 * @deprecated Use /api/assets/[id]/meters/[meterId]/readings instead.
 */
async function getPrimaryMeter(assetId: string) {
  const meter = await prisma.meter.findFirst({
    where: { assetId, isPrimary: true, deletedAt: null },
    select: { id: true, unit: true, name: true },
  })
  if (meter) return meter

  // Fallback: first active meter
  const fallback = await prisma.meter.findFirst({
    where: { assetId, deletedAt: null },
    select: { id: true, unit: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  return fallback
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const meter = await getPrimaryMeter(id)
    if (!meter) {
      return NextResponse.json({ error: 'No meters configured on this asset' }, { status: 404 })
    }

    const readings = await prisma.meterReading.findMany({
      where: { meterId: meter.id, assetId: id, status: { not: 'REJECTED' } },
      orderBy: { readingDate: 'desc' },
      take: 100,
      select: {
        id: true,
        value: true,
        readingDate: true,
        notes: true,
        source: true,
        status: true,
        recordedBy: { select: { name: true } },
        createdAt: true,
      },
    })

    return NextResponse.json(readings.map(r => ({
      ...r,
      recordedBy: r.recordedBy?.name || null
    })))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch meter readings' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const meter = await getPrimaryMeter(id)
    if (!meter) {
      return NextResponse.json({ error: 'No meters configured on this asset' }, { status: 404 })
    }

    // Forward to the meter-specific internal helper
    // For backward compat, we forward through the real API
    const url = new URL(
      `/api/assets/${id}/meters/${meter.id}/readings`,
      request.url,
    )
    const forwardRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await forwardRes.json()

    if (!forwardRes.ok) {
      return NextResponse.json(data, { status: forwardRes.status })
    }

    // Wrap bulk response
    if (body.readings && Array.isArray(body.readings)) {
      return NextResponse.json(data, { status: 201 })
    }

    // Re-shape single reading to match old format (add unit)
    return NextResponse.json({
      ...data,
      unit: meter.unit,
    }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to record meter reading' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    return NextResponse.json(
      { error: 'Direct meter reading deletion is deprecated. Use PATCH to set status=REJECTED instead.' },
      { status: 400 },
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
