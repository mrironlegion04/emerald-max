import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getUserLocationIds } from '@/lib/access-control'

// Minimal QR code generator — encodes URL into a QR matrix using pure TypeScript
// Uses the qrcode library (npm install qrcode @types/qrcode)
import QRCode from 'qrcode'
import { escapeXml } from '@/lib/xml'
import { getPublicBaseUrl } from '@/lib/env'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id }   = await params
    const asset    = await prisma.asset.findUnique({ where: { id }, select: { name: true, assetCode: true, locationId: true } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const locationIds = await getUserLocationIds(user.userId)
    if (locationIds && (!asset.locationId || !locationIds.includes(asset.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const format = new URL(request.url).searchParams.get('format') ?? 'svg'
    const raw    = new URL(request.url).searchParams.get('raw') === 'true'
    const intent = new URL(request.url).searchParams.get('intent') === 'request' ? 'request' : 'asset'
    const baseUrl  = getPublicBaseUrl()
    // Asset labels point at the staff-only asset page; request labels encode a
    // pre-filled request URL that requesters (or staff) can scan to report issues.
    const targetUrl = intent === 'request'
      ? `${baseUrl}/request?assetId=${id}`
      : `${baseUrl}/assets/${id}`
    const suffix  = intent === 'request' ? '-request' : ''
    const caption = intent === 'request'
      ? 'Scan to report an issue'
      : 'Scan to view asset details'

    if (format === 'png') {
      const buf = await QRCode.toBuffer(targetUrl, {
        type: 'png', width: 400, margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      })
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':        'image/png',
          'Content-Disposition': `attachment; filename="qr-${asset.assetCode}${suffix}.png"`,
        },
      })
    }

    // SVG Data
    const svgData = await QRCode.toString(targetUrl, {
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

    // Wrap in a printable card SVG — all user-controlled values are XML-escaped.
    const safeName = escapeXml(asset.name)
    const safeCode = escapeXml(asset.assetCode ?? '')
    const safeUrl  = escapeXml(targetUrl)
    const safeCaption = escapeXml(caption)
    const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="0 0 300 360">
  <rect width="300" height="360" rx="12" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
  <text x="150" y="32" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="13" font-weight="600" fill="#111827">${safeName}</text>
  <text x="150" y="52" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="11" fill="#6b7280">${safeCode}</text>
  <g transform="translate(30, 65) scale(0.93)">${svgData.replace(/<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>
  <text x="150" y="328" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="9" fill="#9ca3af">${safeCaption}</text>
  <text x="150" y="344" text-anchor="middle" font-family="-apple-system,sans-serif"
    font-size="8" fill="#d1d5db">${safeUrl}</text>
</svg>`

    return new NextResponse(cardSvg, {
      headers: {
        'Content-Type':        'image/svg+xml',
        'Content-Disposition': `attachment; filename="qr-${asset.assetCode}${suffix}.svg"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}