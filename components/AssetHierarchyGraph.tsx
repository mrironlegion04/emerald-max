'use client';

// components/AssetHierarchyGraph.tsx
// Dependencies: npm install reactflow dagre @types/dagre

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  AnyNodeData,
  AnyFlowNode,
  AssetNodeData,
  LocationNodeData,
  GraphData,
  GraphStats,
  STATUS_COLORS,
  LOCATION_COLOR,
  applyDagreLayout,
  filterGraphBySearch,
  computeGraphStats,
} from '@/lib/assetGraph';

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DATA: GraphData = {
  nodes: [
    // Locations
    { id: 'loc-1', type: 'locationNode', position: { x: 0, y: 0 }, data: { kind: 'location', label: 'Main Campus', address: '123 Industrial Ave', path: 'Main Campus', parentId: undefined, childLocations: [{ id: 'loc-2', name: 'Building A' }, { id: 'loc-3', name: 'Building B' }], assets: [], assetCount: 0, childLocationCount: 2 } },
    { id: 'loc-2', type: 'locationNode', position: { x: 0, y: 0 }, data: { kind: 'location', label: 'Building A', path: 'Main Campus › Building A', parentId: 'loc-1', childLocations: [{ id: 'loc-4', name: 'Rooftop' }], assets: [{ id: 'asset-2', name: 'Building A HVAC', status: 'UNDER_MAINTENANCE' }], assetCount: 1, childLocationCount: 1 } },
    { id: 'loc-3', type: 'locationNode', position: { x: 0, y: 0 }, data: { kind: 'location', label: 'Building B', path: 'Main Campus › Building B', parentId: 'loc-1', childLocations: [], assets: [{ id: 'asset-5', name: 'Generator Set', status: 'ACTIVE' }], assetCount: 1, childLocationCount: 0 } },
    { id: 'loc-4', type: 'locationNode', position: { x: 0, y: 0 }, data: { kind: 'location', label: 'Rooftop', path: 'Main Campus › Building A › Rooftop', parentId: 'loc-2', childLocations: [], assets: [{ id: 'asset-1', name: 'Chiller Unit', status: 'ACTIVE' }], assetCount: 1, childLocationCount: 0 } },
    // Assets
    { id: 'asset-1', type: 'assetNode', position: { x: 0, y: 0 }, data: { kind: 'asset', label: 'Chiller Unit', assetCode: 'CHU-001', status: 'ACTIVE', location: 'Rooftop', category: 'HVAC', criticality: 'HIGH', manufacturer: 'Trane', parentId: 'loc-4', workOrders: [], assetChildren: [{ id: 'asset-3', name: 'Compressor A', status: 'ACTIVE' }, { id: 'asset-4', name: 'Pump B', status: 'INACTIVE' }], childCount: 2 } },
    { id: 'asset-2', type: 'assetNode', position: { x: 0, y: 0 }, data: { kind: 'asset', label: 'Building A HVAC', assetCode: 'HVC-002', status: 'UNDER_MAINTENANCE', location: 'Building A', category: 'HVAC', criticality: 'CRITICAL', parentId: 'loc-2', workOrders: [{ id: 'wo1', woNumber: 'WO-0042', title: 'Compressor fault', status: 'OPEN', priority: 'CRITICAL' }], assetChildren: [], childCount: 0 } },
    { id: 'asset-3', type: 'assetNode', position: { x: 0, y: 0 }, data: { kind: 'asset', label: 'Compressor A', assetCode: 'CMP-003', status: 'ACTIVE', category: 'Compressor', parentId: 'asset-1', workOrders: [], assetChildren: [], childCount: 0 } },
    { id: 'asset-4', type: 'assetNode', position: { x: 0, y: 0 }, data: { kind: 'asset', label: 'Pump B', assetCode: 'PMP-004', status: 'INACTIVE', category: 'Pump', parentId: 'asset-1', workOrders: [], assetChildren: [], childCount: 0 } },
    { id: 'asset-5', type: 'assetNode', position: { x: 0, y: 0 }, data: { kind: 'asset', label: 'Generator Set', assetCode: 'GEN-001', status: 'ACTIVE', location: 'Building B', category: 'Generator', criticality: 'CRITICAL', manufacturer: 'Caterpillar', parentId: 'loc-3', workOrders: [], assetChildren: [], childCount: 0 } },
  ],
  edges: [
    { id: 'e-loc-1-2', source: 'loc-1', target: 'loc-2', type: 'smoothstep', style: { stroke: '#a5b4fc', strokeWidth: 1.5 } },
    { id: 'e-loc-1-3', source: 'loc-1', target: 'loc-3', type: 'smoothstep', style: { stroke: '#a5b4fc', strokeWidth: 1.5 } },
    { id: 'e-loc-2-4', source: 'loc-2', target: 'loc-4', type: 'smoothstep', style: { stroke: '#a5b4fc', strokeWidth: 1.5 } },
    { id: 'e-loc-4-a1', source: 'loc-4', target: 'asset-1', type: 'smoothstep', style: { stroke: '#a5b4fc', strokeWidth: 1.5, strokeDasharray: '5 4' } },
    { id: 'e-loc-2-a2', source: 'loc-2', target: 'asset-2', type: 'smoothstep', style: { stroke: '#a5b4fc', strokeWidth: 1.5, strokeDasharray: '5 4' } },
    { id: 'e-loc-3-a5', source: 'loc-3', target: 'asset-5', type: 'smoothstep', style: { stroke: '#a5b4fc', strokeWidth: 1.5, strokeDasharray: '5 4' } },
    { id: 'e-a1-a3', source: 'asset-1', target: 'asset-3', type: 'smoothstep', style: { stroke: '#cbd5e1', strokeWidth: 1.5 } },
    { id: 'e-a1-a4', source: 'asset-1', target: 'asset-4', type: 'smoothstep', style: { stroke: '#cbd5e1', strokeWidth: 1.5 } },
  ],
  metadata: { totalAssets: 5, totalLocations: 4, rootCount: 1, timestamp: new Date().toISOString() },
};

// ── Tailwind pill maps ────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-100 text-slate-600',
  UNDER_MAINTENANCE: 'bg-amber-100 text-amber-800',
  DECOMMISSIONED: 'bg-red-100 text-red-700',
};

const WO_STATUS_PILL: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  ON_HOLD: 'bg-slate-100 text-slate-600',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PRIORITY_PILL: Record<string, string> = {
  LOW: 'bg-blue-50 text-blue-600',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-red-50 text-red-600',
  CRITICAL: 'bg-purple-50 text-purple-700',
};

const CRITICALITY_PILL: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
  CRITICAL: 'bg-purple-100 text-purple-700',
};

// ── Location Node ─────────────────────────────────────────────────────────────

function LocationNodeRenderer({ data, selected }: NodeProps<LocationNodeData>) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, background: LOCATION_COLOR, border: '2px solid white' }}
      />

      <div
        className="bg-white rounded-xl cursor-pointer transition-all duration-200"
        style={{
          minWidth: 190,
          maxWidth: 210,
          border: `${selected ? 2 : 1}px solid ${selected ? LOCATION_COLOR : '#c7d2fe'}`,
          borderLeft: `4px solid ${LOCATION_COLOR}`,
          boxShadow: selected
            ? `0 0 0 3px ${LOCATION_COLOR}20, 0 8px 20px rgba(0,0,0,0.1)`
            : '0 2px 8px rgba(99,102,241,0.08)',
        }}
      >
        {/* Header */}
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-2">
            {/* Pin icon */}
            <div
              className="size-6 rounded-lg flex items-center justify-center text-white text-xs shrink-0"
              style={{ backgroundColor: LOCATION_COLOR }}
            >
              📍
            </div>
            <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">
              {data.label}
            </p>
          </div>

          {/* Breadcrumb path */}
          {data.path && data.path !== data.label && (
            <p className="text-[9px] text-indigo-400 mt-1 truncate font-medium">
              {data.path}
            </p>
          )}
        </div>

        {/* Footer counts */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-indigo-50 bg-indigo-50/50 rounded-b-xl">
          {data.childLocationCount > 0 && (
            <span className="text-[10px] text-indigo-600 font-semibold">
              📁 {data.childLocationCount} sub-location{data.childLocationCount > 1 ? 's' : ''}
            </span>
          )}
          {data.assetCount > 0 && (
            <span className="text-[10px] text-slate-500 font-semibold">
              ⚙️ {data.assetCount} asset{data.assetCount > 1 ? 's' : ''}
            </span>
          )}
          {data.childLocationCount === 0 && data.assetCount === 0 && (
            <span className="text-[10px] text-slate-400">Empty</span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 10, height: 10, background: LOCATION_COLOR, border: '2px solid white' }}
      />
    </>
  );
}

// ── Asset Node ────────────────────────────────────────────────────────────────

function AssetNodeRenderer({ data, selected }: NodeProps<AssetNodeData>) {
  const borderColor = STATUS_COLORS[data.status] ?? '#9ca3af';
  const hasOpenWOs = data.workOrders.some((wo) => ['OPEN', 'IN_PROGRESS'].includes(wo.status));

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, background: borderColor, border: '2px solid white' }}
      />

      <div
        className="bg-white rounded-xl cursor-pointer transition-all duration-200"
        style={{
          minWidth: 210,
          maxWidth: 230,
          border: `${selected ? 2 : 1}px solid ${selected ? borderColor : '#e2e8f0'}`,
          borderLeft: `4px solid ${borderColor}`,
          boxShadow: selected
            ? `0 0 0 3px ${borderColor}25, 0 8px 20px rgba(0,0,0,0.1)`
            : '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-start gap-2">
            <div className="mt-1 size-2 rounded-full shrink-0" style={{ backgroundColor: borderColor }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">{data.label}</p>
              {data.assetCode && (
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{data.assetCode}</p>
              )}
            </div>
            {hasOpenWOs && <span className="text-xs shrink-0" title="Has open work orders">⚠️</span>}
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {data.category && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                {data.category}
              </span>
            )}
            {data.criticality && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CRITICALITY_PILL[data.criticality] ?? 'bg-slate-100 text-slate-500'}`}>
                {data.criticality}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-50">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[data.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {data.status.replace(/_/g, ' ')}
          </span>
          {data.childCount > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              {data.childCount} child{data.childCount > 1 ? 'ren' : ''}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 10, height: 10, background: borderColor, border: '2px solid white' }}
      />
    </>
  );
}

// Module-level — never recreated, prevents React Flow warning #002
const NODE_TYPES = {
  assetNode: AssetNodeRenderer,
  locationNode: LocationNodeRenderer,
};

// ── Details Panel ─────────────────────────────────────────────────────────────

function DetailsPanel({ node, onClose }: { node: AnyFlowNode | null; onClose: () => void }) {
  if (!node) return null;
  const d = node.data as AnyNodeData;

  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-2xl overflow-y-auto z-20 flex flex-col">
      {d.kind === 'location' ? (
        <LocationDetail data={d} onClose={onClose} />
      ) : (
        <AssetDetail data={d} onClose={onClose} />
      )}
    </div>
  );
}

// ── Location Detail ───────────────────────────────────────────────────────────

function LocationDetail({ data, onClose }: { data: LocationNodeData; onClose: () => void }) {
  return (
    <>
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-slate-100"
        style={{ borderTop: `4px solid ${LOCATION_COLOR}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="size-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${LOCATION_COLOR}18` }}
            >
              📍
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{data.label}</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                Location
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 size-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-5 space-y-5">
        {/* Path */}
        {data.path && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Path</p>
            <p className="text-sm text-indigo-600 font-medium">{data.path}</p>
          </div>
        )}

        {/* Address */}
        {data.address && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</p>
            <p className="text-sm text-slate-700">{data.address}</p>
          </div>
        )}

        {/* Summary chips */}
        <div className="flex gap-3">
          <div className="flex-1 bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-indigo-700">{data.childLocationCount}</p>
            <p className="text-[10px] text-indigo-500 font-medium mt-0.5">Sub-locations</p>
          </div>
          <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-slate-700">{data.assetCount}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Assets</p>
          </div>
        </div>

        {/* Child locations */}
        {data.childLocations.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Sub-locations ({data.childLocations.length})
            </p>
            <div className="space-y-1.5">
              {data.childLocations.map((loc) => (
                <div key={loc.id} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100 text-sm text-indigo-800">
                  <span className="text-indigo-400 text-xs">📁</span>
                  {loc.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assets at this location */}
        {data.assets.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Assets here ({data.assets.length})
            </p>
            <div className="space-y-1.5">
              {data.assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[asset.status] ?? '#9ca3af' }}
                    />
                    <span className="text-sm text-slate-700 truncate">{asset.name}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${STATUS_PILL[asset.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {asset.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.childLocations.length === 0 && data.assets.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No child locations or assets
          </div>
        )}
      </div>
    </>
  );
}

// ── Asset Detail ──────────────────────────────────────────────────────────────

function AssetDetail({ data, onClose }: { data: AssetNodeData; onClose: () => void }) {
  const accentColor = STATUS_COLORS[data.status] ?? '#9ca3af';
  const warrantyDate = data.warrantyExpiry ? new Date(data.warrantyExpiry) : null;
  const warrantyExpired = warrantyDate ? warrantyDate < new Date() : false;

  return (
    <>
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-slate-100"
        style={{ borderTop: `4px solid ${accentColor}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{data.label}</h2>
            {data.assetCode && <p className="text-xs font-mono text-slate-400 mt-1">{data.assetCode}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 size-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm transition-colors"
          >
            ✕
          </button>
        </div>
        <span className={`inline-block mt-3 text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_PILL[data.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {data.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-5 space-y-6">

        {/* Location breadcrumb */}
        {data.locationPath && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
            <p className="text-sm text-indigo-600 font-medium">{data.locationPath}</p>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {data.category && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
              <p className="text-sm text-slate-700 font-medium">{data.category}</p>
            </div>
          )}
          {data.criticality && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Criticality</p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CRITICALITY_PILL[data.criticality] ?? 'bg-slate-100 text-slate-600'}`}>
                {data.criticality}
              </span>
            </div>
          )}
          {data.manufacturer && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manufacturer</p>
              <p className="text-sm text-slate-700 font-medium">{data.manufacturer}</p>
            </div>
          )}
          {data.serialNumber && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Serial No.</p>
              <p className="text-[11px] font-mono text-slate-600">{data.serialNumber}</p>
            </div>
          )}
          {warrantyDate && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Warranty</p>
              <p className={`text-sm font-semibold ${warrantyExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                {warrantyExpired ? '⚠ Expired' : '✓ Valid'}
                <span className="text-slate-400 font-normal text-xs ml-1">({warrantyDate.toLocaleDateString()})</span>
              </p>
            </div>
          )}
        </div>

        {/* Owner */}
        {data.owner && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Owner</p>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="size-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                {data.owner.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{data.owner.name}</p>
                <p className="text-xs text-slate-400">{data.owner.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Child assets */}
        {data.assetChildren && data.assetChildren.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Child Assets ({data.assetChildren.length})
            </p>
            <div className="space-y-1.5">
              {data.assetChildren.map((child) => (
                <div key={child.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-700">
                  <div
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: child.status ? STATUS_COLORS[child.status] ?? '#94a3b8' : '#94a3b8' }}
                  />
                  {child.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work orders */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            Work Orders
            {data.workOrders.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {data.workOrders.length}
              </span>
            )}
          </p>

          {data.workOrders.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No active work orders
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {data.workOrders.map((wo) => (
                <div key={wo.id} className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold text-slate-800">{wo.woNumber}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WO_STATUS_PILL[wo.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {wo.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">{wo.title}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_PILL[wo.priority] ?? 'bg-slate-100 text-slate-500'}`}>
                    {wo.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: GraphStats }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-md z-10 pointer-events-none whitespace-nowrap">
      <div className="flex items-center gap-1.5 text-xs">
        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: LOCATION_COLOR }} />
        <span className="text-slate-500">Locations</span>
        <span className="font-bold text-slate-900">{stats.totalLocations}</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      <div className="flex items-center gap-1.5 text-xs">
        <div className="size-2 rounded-full bg-slate-400" />
        <span className="text-slate-500">Assets</span>
        <span className="font-bold text-slate-900">{stats.totalAssets}</span>
      </div>
      {Object.entries(stats.byStatus).map(([status, count]) => (
        <div key={status} className="flex items-center gap-1.5 text-xs">
          <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] ?? '#9ca3af' }} />
          <span className="text-slate-500">{status.replace(/_/g, ' ')}</span>
          <span className="font-bold text-slate-900">{count}</span>
        </div>
      ))}
      {stats.withOpenWOs > 0 && (
        <>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5 text-xs">
            <span>⚠️</span>
            <span className="text-slate-500">Open WOs</span>
            <span className="font-bold text-slate-900">{stats.withOpenWOs}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Search Bar ────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 shadow-md min-w-56">
      <svg className="size-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        placeholder="Search locations & assets…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-slate-400 hover:text-slate-600 text-sm shrink-0 transition-colors">✕</button>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

interface LegendProps {
  onToggle: () => void;
}

function Legend({ onToggle }: LegendProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg w-48 space-y-3 pointer-events-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <span className="text-xs font-bold text-slate-800">Legend</span>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-slate-600 text-xs font-semibold transition-colors"
        >
          Hide
        </button>
      </div>
      {/* Node types */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Node Type</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full" style={{ backgroundColor: LOCATION_COLOR }} />
            <span className="text-[11px] text-slate-500">Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-slate-400" />
            <span className="text-[11px] text-slate-500">Asset</span>
          </div>
        </div>
      </div>
      {/* Edge types */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Edge Type</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#a5b4fc" strokeWidth="2" /></svg>
            <span className="text-[11px] text-slate-500">Loc → Loc</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#a5b4fc" strokeWidth="2" strokeDasharray="4 3" /></svg>
            <span className="text-[11px] text-slate-500">Loc → Asset</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#cbd5e1" strokeWidth="2" /></svg>
            <span className="text-[11px] text-slate-500">Asset → Asset</span>
          </div>
        </div>
      </div>
      {/* Asset status */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Asset Status</p>
        <div className="space-y-1.5">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-slate-500">{status.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inner graph ───────────────────────────────────────────────────────────────

function AssetGraphInner() {
  const [allNodes, setAllNodes] = useState<AnyFlowNode[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<AnyFlowNode | null>(null);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [showLegend, setShowLegend] = useState(true);

  const { fitView } = useReactFlow();
  const fitViewRef = useRef(fitView);
  useEffect(() => { fitViewRef.current = fitView; }, [fitView]);

  // Fetch once on mount
  useEffect(() => {
    let cancelled = false;

    const load = async (data: GraphData) => {
      const { nodes: positioned, edges: laid } = await applyDagreLayout(data.nodes, data.edges as Edge[]);
      if (!cancelled) {
        setAllNodes(positioned);
        setAllEdges(laid);
        setNodes(positioned);
        setEdges(laid);
        setStats(computeGraphStats(positioned));
        setLoading(false);
        setTimeout(() => fitViewRef.current({ padding: 0.15, duration: 600 }), 150);
      }
    };

    (async () => {
      try {
        const res = await fetch('/api/assets/hierarchy');
        const data: GraphData = res.ok ? await res.json() : MOCK_DATA;
        await load(!data.nodes?.length ? MOCK_DATA : data);
      } catch {
        await load(MOCK_DATA);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Search filter
  useEffect(() => {
    if (!allNodes.length) return;
    const { nodes: filtered, edges: filteredEdges } = filterGraphBySearch(allNodes, allEdges, search);
    setNodes(filtered);
    setEdges(filteredEdges);
    setTimeout(() => fitViewRef.current({ padding: search ? 0.25 : 0.15, duration: 400 }), 50);
  }, [search, allNodes, allEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as AnyFlowNode);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin inline-block">⚙️</div>
          <p className="text-base font-bold text-slate-700">Loading hierarchy…</p>
          <p className="text-sm text-slate-400 mt-1">Building locations & asset graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        attributionPosition="bottom-right"
        minZoom={0.05}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#e2e8f0" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => {
            const d = n.data as AnyNodeData;
            return d?.kind === 'location' ? LOCATION_COLOR : STATUS_COLORS[d?.status] ?? '#9ca3af';
          }}
          maskColor="rgba(248,250,252,0.75)"
        />
        <Panel position="bottom-left" className="ml-16 mb-2">
          {showLegend ? (
            <Legend onToggle={() => setShowLegend(false)} />
          ) : (
            <button
              onClick={() => setShowLegend(true)}
              className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-md text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors pointer-events-auto"
            >
              <span>🗺️</span> Show Legend
            </button>
          )}
        </Panel>
      </ReactFlow>

      <SearchBar value={search} onChange={setSearch} />
      {stats && <StatsBar stats={stats} />}
      <DetailsPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function AssetHierarchyGraph() {
  return (
    <ReactFlowProvider>
      <AssetGraphInner />
    </ReactFlowProvider>
  );
}