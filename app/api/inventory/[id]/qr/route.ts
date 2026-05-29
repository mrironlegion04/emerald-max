import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import QRCode from 'qrcode'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const part = await prisma.part.findUnique({
      where: { id },
      select: { name: true, partNumber: true },
    })
    if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })

    const format = new URL(request.url).searchParams.get('format') ?? 'svg'
    const raw    = new URL(request.url).searchParams.get('raw') === 'true'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const partUrl = `${baseUrl}/inventory/${id}`

    if (format === 'png') {
      const buf = await QRCode.toBuffer(partUrl, {
        type: 'png',
        width: 400,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      })
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="qr-${part.partNumber}.png"`,
        },
      })
    }

    // SVG Data
    const svgData = await QRCode.toString(partUrl, {
      type: 'svg',
      margin: raw ? 0 : 2,
      color: { dark: '#111827', light: '#ffffff' },
    })

    if (raw) {
      return new NextResponse(svgData, {
        headers: {
          'Content-Type': 'image/svg+xml',
        },
      })
    }

    // Wrap in a printable card SVG
    const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="0 0 300 360">
  <rect width="300" height="360" rx="12" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
  <text x="150" y="32" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="13" font-weight="600" fill="#111827">${part.name}</text>
  <text x="150" y="52" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="11" fill="#6b7280">${part.partNumber}</text>
  <g transform="translate(30, 65) scale(0.93)">${svgData.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>
  <text x="150" y="328" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="9" fill="#9ca3af">Scan to view part details</text>
  <text x="150" y="344" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="8" fill="#d1d5db">${partUrl}</text>
</svg>`

    return new NextResponse(cardSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `attachment; filename="qr-${part.partNumber}.svg"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
