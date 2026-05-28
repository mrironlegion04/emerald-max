import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { buildLocationPath } from '@/lib/location-path'
import { z } from 'zod'

const locationSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  address:  z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

type FlatLocation = {
  id: string
  name: string
  address: string | null
  parentId: string | null
  path: string | null
  _count: { assets: number; children: number }
}

/** Nest a flat array into a tree (max depth 10 to be safe) */
function nestLocations(flat: FlatLocation[], parentId: string | null = null, depth = 0): any[] {
  if (depth > 10) return []
  return flat
    .filter(l => l.parentId === parentId)
    .map(l => ({
      ...l,
      children: nestLocations(flat, l.id, depth + 1),
    }))
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()

    // ── Search mode: return flat results with breadcrumb path ──
    if (search) {
      const results = await prisma.location.findMany({
        where: { name: { contains: search, mode: 'insensitive' } },
        orderBy: { name: 'asc' },
        include: { _count: { select: { assets: true, children: true } } },
        take: 50,
      })

      // Attach breadcrumb — use cached path if available, otherwise compute
      const allLocations = await prisma.location.findMany({
        select: { id: true, name: true, parentId: true },
      })

      const enriched = results.map((loc: any) => {
        let breadcrumb = loc.path
        if (!breadcrumb) {
          // compute from flat list (no extra DB calls)
          const crumbs: string[] = []
          let cur: { id: string; name: string; parentId: string | null } | undefined =
            allLocations.find(l => l.id === loc.id)
          while (cur) {
            crumbs.unshift(cur.name)
            cur = cur.parentId ? allLocations.find(l => l.id === cur!.parentId) : undefined
          }
          breadcrumb = crumbs.join(' › ')
        }
        return { ...loc, breadcrumb }
      })

      return NextResponse.json(enriched)
    }

    // ── Default mode: return nested tree ──
    const flat = await prisma.location.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: true, children: true } } },
    })

    const nested = nestLocations(flat as FlatLocation[])
    return NextResponse.json(nested)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const data = locationSchema.parse(body)

    // Build path before creating
    const path = await buildLocationPath(data.parentId ?? null, data.name)

    const location = await prisma.location.create({
      data: {
        name:     data.name,
        address:  data.address  ?? null,
        parentId: data.parentId ?? null,
        path,
      },
      include: { _count: { select: { assets: true, children: true } } },
    })


    await writeAudit({
      action: 'CREATE',
      entity: 'Location',
      entityId: location.id,
      entityName: location.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}
