// lib/assetGraph.ts
import { Node, Edge } from 'reactflow';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeKind = 'location' | 'asset';

export interface WorkOrderSummary {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
}

/** Data carried by an Asset node */
export interface AssetNodeData {
  kind: 'asset';
  label: string;
  assetCode?: string;
  status: string;
  location?: string;
  locationPath?: string;
  category?: string;
  criticality?: string;
  manufacturer?: string;
  serialNumber?: string;
  warrantyExpiry?: string;
  imageUrl?: string;
  owner?: { id: string; name: string; email: string };
  workOrders: WorkOrderSummary[];
  assetChildren: Array<{ id: string; name: string; status?: string }>;
  childCount: number;
  parentId?: string;
}

/** Data carried by a Location node */
export interface LocationNodeData {
  kind: 'location';
  label: string;
  address?: string;
  path?: string;           // breadcrumb: "Plant A › Building 2 › Line 3"
  parentId?: string;
  childLocations: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string; status: string }>;
  assetCount: number;
  childLocationCount: number;
}

export type AnyNodeData = AssetNodeData | LocationNodeData;
export type AnyFlowNode = Node<AnyNodeData>;
export type AssetFlowNode = Node<AssetNodeData>;
export type LocationFlowNode = Node<LocationNodeData>;
export type AssetFlowEdge = Edge;

export interface GraphData {
  nodes: AnyFlowNode[];
  edges: AssetFlowEdge[];
  metadata: {
    totalAssets: number;
    totalLocations: number;
    rootCount: number;
    timestamp: string;
  };
}

// ── Status / Priority colors ──────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  INACTIVE: '#6b7280',
  UNDER_MAINTENANCE: '#f59e0b',
  DECOMMISSIONED: '#ef4444',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#3b82f6',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#7c3aed',
};

// Location nodes use a consistent indigo accent
export const LOCATION_COLOR = '#6366f1';

// ── Layout with Dagre ─────────────────────────────────────────────────────────

const ASSET_NODE_WIDTH = 220;
const ASSET_NODE_HEIGHT = 95;
const LOC_NODE_WIDTH = 200;
const LOC_NODE_HEIGHT = 75;

export async function applyDagreLayout(
  nodes: AnyFlowNode[],
  edges: AssetFlowEdge[]
): Promise<{ nodes: AnyFlowNode[]; edges: AssetFlowEdge[] }> {
  try {
    const dagre = (await import('dagre')).default;
    const g = new dagre.graphlib.Graph({ multigraph: false });
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 55, ranksep: 260, edgesep: 20, marginx: 60, marginy: 60 });

    nodes.forEach((node) => {
      const isLoc = (node.data as AnyNodeData).kind === 'location';
      g.setNode(node.id, {
        width: isLoc ? LOC_NODE_WIDTH : ASSET_NODE_WIDTH,
        height: isLoc ? LOC_NODE_HEIGHT : ASSET_NODE_HEIGHT,
      });
    });

    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
      const { x, y } = g.node(node.id);
      const isLoc = (node.data as AnyNodeData).kind === 'location';
      return {
        ...node,
        position: {
          x: x - (isLoc ? LOC_NODE_WIDTH : ASSET_NODE_WIDTH) / 2,
          y: y - (isLoc ? LOC_NODE_HEIGHT : ASSET_NODE_HEIGHT) / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  } catch (err) {
    console.warn('[assetGraph] dagre unavailable, using manual layout:', err);
    return manualDepthLayout(nodes, edges);
  }
}

// ── Manual fallback layout ────────────────────────────────────────────────────

export function manualDepthLayout(
  nodes: AnyFlowNode[],
  edges: AssetFlowEdge[]
): { nodes: AnyFlowNode[]; edges: AssetFlowEdge[] } {
  const depths = computeDepths(nodes, edges);
  const byDepth = new Map<number, AnyFlowNode[]>();
  nodes.forEach((n) => {
    const d = depths.get(n.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  });

  const positioned = nodes.map((node) => {
    const depth = depths.get(node.id) ?? 0;
    const siblings = byDepth.get(depth)!;
    const idx = siblings.findIndex((n) => n.id === node.id);
    return { ...node, position: { x: depth * 300 + 40, y: idx * 120 + 40 } };
  });

  return { nodes: positioned, edges };
}

// ── Depth computation ─────────────────────────────────────────────────────────

export function computeDepths(nodes: Node[], edges: Edge[]): Map<string, number> {
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));

  const childrenOf = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source)!.push(e.target);
  });

  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);
  const depths = new Map<string, number>();
  const queue: Array<[string, number]> = roots.map((n) => [n.id, 0]);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [id, depth] = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    depths.set(id, depth);
    (childrenOf.get(id) ?? []).forEach((c) => { if (!visited.has(c)) queue.push([c, depth + 1]); });
  }
  return depths;
}

// ── Search filter ─────────────────────────────────────────────────────────────

export function filterGraphBySearch(
  nodes: AnyFlowNode[],
  edges: AssetFlowEdge[],
  query: string
): { nodes: AnyFlowNode[]; edges: AssetFlowEdge[] } {
  if (!query.trim()) return { nodes, edges };
  const q = query.toLowerCase();

  const matchIds = new Set(
    nodes
      .filter((n) => {
        const d = n.data as AnyNodeData;
        if (d.kind === 'location') {
          return d.label.toLowerCase().includes(q) || d.address?.toLowerCase().includes(q) || d.path?.toLowerCase().includes(q);
        } else {
          return (
            d.label.toLowerCase().includes(q) ||
            d.assetCode?.toLowerCase().includes(q) ||
            d.location?.toLowerCase().includes(q) ||
            d.category?.toLowerCase().includes(q)
          );
        }
      })
      .map((n) => n.id)
  );

  const parentOf = new Map<string, string>();
  edges.forEach((e) => parentOf.set(e.target, e.source));

  const included = new Set<string>(matchIds);
  matchIds.forEach((id) => {
    let cur = parentOf.get(id);
    while (cur) { included.add(cur); cur = parentOf.get(cur); }
  });

  return {
    nodes: nodes.filter((n) => included.has(n.id)),
    edges: edges.filter((e) => included.has(e.source) && included.has(e.target)),
  };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface GraphStats {
  totalAssets: number;
  totalLocations: number;
  byStatus: Record<string, number>;
  withOpenWOs: number;
}

export function computeGraphStats(nodes: AnyFlowNode[]): GraphStats {
  const byStatus: Record<string, number> = {};
  let withOpenWOs = 0;
  let totalAssets = 0;
  let totalLocations = 0;

  nodes.forEach((n) => {
    const d = n.data as AnyNodeData;
    if (d.kind === 'location') {
      totalLocations++;
    } else {
      totalAssets++;
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      if (d.workOrders.some((wo) => ['OPEN', 'IN_PROGRESS'].includes(wo.status))) withOpenWOs++;
    }
  });

  return { totalAssets, totalLocations, byStatus, withOpenWOs };
}