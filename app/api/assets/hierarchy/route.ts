// app/api/assets/hierarchy/route.ts
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    // ── 1. Fetch all locations ───────────────────────────────────────────────
    const locations = await prisma.location.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        assets: {
          select: { id: true, name: true, status: true },
          where: {
            isDeleted: false,
            ...(search
              ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { assetCode: { contains: search, mode: 'insensitive' as const } }] }
              : {}),
          },
        },
      },
      ...(search
        ? { where: { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { address: { contains: search, mode: 'insensitive' as const } }] } }
        : {}),
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });

    // ── 2. Fetch all assets (excluding deleted) ──────────────────────────────
    const assets = await prisma.asset.findMany({
      where: {
        isDeleted: false,
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { assetCode: { contains: search, mode: 'insensitive' as const } }] }
          : {}),
      },
      include: {
        location: { select: { id: true, name: true, path: true } },
        category: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, status: true } },
        workOrders: {
          where: { status: { not: 'CANCELLED' } },
          select: { id: true, woNumber: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ locationId: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
    });

    // ── 3. Build Location nodes ──────────────────────────────────────────────
    const locationNodes = locations.map((loc: any) => ({
      id: `loc-${loc.id}`,
      type: 'locationNode',
      position: { x: 0, y: 0 },
      data: {
        kind: 'location' as const,
        label: loc.name,
        address: loc.address ?? undefined,
        path: loc.path ?? undefined,
        parentId: loc.parentId ? `loc-${loc.parentId}` : undefined,
        childLocations: loc.children.map((c: any) => ({ id: `loc-${c.id}`, name: c.name })),
        assets: loc.assets.map((a: any) => ({ id: `asset-${a.id}`, name: a.name, status: a.status })),
        assetCount: loc.assets.length,
        childLocationCount: loc.children.length,
      },
    }));

    // ── 4. Build Asset nodes ─────────────────────────────────────────────────
    const assetNodes = assets.map((asset: any) => ({
      id: `asset-${asset.id}`,
      type: 'assetNode',
      position: { x: 0, y: 0 },
      data: {
        kind: 'asset' as const,
        label: asset.name,
        assetCode: asset.assetCode ?? undefined,
        status: asset.status,
        location: asset.location?.name ?? undefined,
        locationPath: asset.location?.path ?? undefined,
        category: asset.category?.name ?? undefined,
        criticality: asset.criticality ?? undefined,
        manufacturer: (asset as any).manufacturer ?? undefined,
        serialNumber: (asset as any).serialNumber ?? undefined,
        warrantyExpiry: (asset as any).warrantyExpiry?.toISOString() ?? undefined,
        imageUrl: (asset as any).imageUrl ?? undefined,
        owner: asset.owner ?? undefined,
        workOrders: asset.workOrders ?? [],
        assetChildren: asset.children ?? [],
        childCount: asset.children?.length ?? 0,
        // parentId: prefer asset parent, fall back to location parent
        parentId: asset.parentId
          ? `asset-${asset.parentId}`
          : asset.locationId
          ? `loc-${asset.locationId}`
          : undefined,
      },
    }));

    // ── 5. Build edges ───────────────────────────────────────────────────────
    const edges: Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      style: object;
      markerEnd: object;
    }> = [];

    const edgeStyle = (dashed = false) => ({
      stroke: dashed ? '#a5b4fc' : '#cbd5e1',
      strokeWidth: 1.5,
      strokeDasharray: dashed ? '5 4' : undefined,
    });

    const arrowEnd = (color: string) => ({
      type: 'arrowclosed',
      color,
      width: 14,
      height: 14,
    });

    // Location → child location edges (solid indigo-ish)
    locations.forEach((loc: any) => {
      if (loc.parentId) {
        edges.push({
          id: `e-loc-${loc.parentId}-${loc.id}`,
          source: `loc-${loc.parentId}`,
          target: `loc-${loc.id}`,
          type: 'smoothstep',
          style: { stroke: '#a5b4fc', strokeWidth: 1.5 },
          markerEnd: arrowEnd('#a5b4fc'),
        });
      }
    });

    // Asset → child asset edges (solid slate)
    assets.forEach((asset: any) => {
      if (asset.parentId) {
        edges.push({
          id: `e-asset-${asset.parentId}-${asset.id}`,
          source: `asset-${asset.parentId}`,
          target: `asset-${asset.id}`,
          type: 'smoothstep',
          style: edgeStyle(false),
          markerEnd: arrowEnd('#cbd5e1'),
        });
      } else if (asset.locationId) {
        // Location → root asset edge (dashed, crossing boundary between loc and asset)
        edges.push({
          id: `e-loc-${asset.locationId}-asset-${asset.id}`,
          source: `loc-${asset.locationId}`,
          target: `asset-${asset.id}`,
          type: 'smoothstep',
          style: edgeStyle(true),
          markerEnd: arrowEnd('#a5b4fc'),
        });
      }
    });

    const allNodes = [...locationNodes, ...assetNodes];

    return NextResponse.json({
      nodes: allNodes,
      edges,
      metadata: {
        totalAssets: assetNodes.length,
        totalLocations: locationNodes.length,
        rootCount: allNodes.filter((n: any) => !n.data.parentId).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Asset Hierarchy API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hierarchy', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}