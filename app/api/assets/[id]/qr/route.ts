import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// Minimal QR code generator — encodes URL into a QR matrix using pure TypeScript
// Uses the qrcode library (npm install qrcode @types/qrcode)
import QRCode from 'qrcode'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id }   = await params
    const asset    = await prisma.asset.findUnique({ where: { id }, select: { name: true, assetCode: true } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const format = new URL(request.url).searchParams.get('format') ?? 'svg'
    const raw    = new URL(request.url).searchParams.get('raw') === 'true'
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const assetUrl = `${baseUrl}/assets/${id}`

    if (format === 'png') {
      const buf = await QRCode.toBuffer(assetUrl, {
        type: 'png', width: 400, margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      })
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':        'image/png',
          'Content-Disposition': `attachment; filename="qr-${asset.assetCode}.png"`,
        },
      })
    }

    // SVG Data
    const svgData = await QRCode.toString(assetUrl, {
      type: 'svg', margin: raw ? 0 : 2,
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
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="340" viewBox="0 0 300 340">
  <rect width="298" height="338" x="1" y="1" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="150" y="44" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#0f172a">${asset.name}</text>
  <text x="150" y="68" text-anchor="middle" font-family="monospace" font-size="14" font-weight="600" fill="#64748b" letter-spacing="1">${asset.assetCode || ''}</text>
  <rect x="50" y="85" width="200" height="200" rx="16" fill="#f8fafc"/>
  <g transform="translate(50, 85)">${svgData.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>
  <line x1="40" y1="300" x2="260" y2="300" stroke="#f1f5f9" stroke-width="1"/>
  <text x="150" y="322" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="2">SCAN TO VIEW ASSET</text>
</svg>`

    return new NextResponse(cardSvg, {
      headers: {
        'Content-Type':        'image/svg+xml',
        'Content-Disposition': `attachment; filename="qr-${asset.assetCode}.svg"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}