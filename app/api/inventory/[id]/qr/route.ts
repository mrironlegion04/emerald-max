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

    // SVG Data (raw QR)
    const qrSvg = await QRCode.toString(partUrl, {
      type: 'svg',
      margin: 0, // No margin for raw QR inside card
      color: { dark: '#000000', light: '#ffffff' },
    })

    if (raw) {
      return new NextResponse(qrSvg, {
        headers: { 'Content-Type': 'image/svg+xml' },
      })
    }

    // Wrap in a professional label SVG (300x340)
    const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="340" viewBox="0 0 300 340">
  <!-- Material-like Card -->
  <rect width="290" height="330" x="5" y="5" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  
  <!-- Header Section -->
  <text x="150" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#0f172a">${part.name}</text>
  <text x="150" y="68" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="13" font-weight="600" fill="#64748b" letter-spacing="1">${part.partNumber || 'NO-PN'}</text>
  
  <!-- QR Area with subtle backing -->
  <rect x="55" y="85" width="190" height="190" rx="16" fill="#f8fafc"/>
  <g transform="translate(65, 95) scale(0.85)">
    ${qrSvg.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>
  
  <!-- Footer Branding -->
  <line x1="40" y1="295" x2="260" y2="295" stroke="#f1f5f9" stroke-width="1.5"/>
  <text x="150" y="318" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="2.5">INVENTORY TAG</text>
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
