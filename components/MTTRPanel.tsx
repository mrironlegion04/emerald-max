'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AssetMetric {
  assetId: string; assetName: string; assetCode: string
  failureCount: number; avgMTTR: number; avgMTBF: number; totalLaborHours: number
}
interface Summary { totalAssets: number; totalFailures: number; fleetAvgMTTR: number; fleetAvgMTBF: number }

function badge(val: number, goodThreshold: number, higherIsBetter: boolean) {
  const good = higherIsBetter ? val >= goodThreshold : val <= goodThreshold
  return good
    ? 'bg-green-100 text-green-700'
    : val === 0 ? 'bg-gray-100 text-gray-500'
    : 'bg-red-100 text-red-700'
}

export default function MTTRPanel() {
  const [data,    setData]    = useState<{ assets: AssetMetric[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/mttr').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-48" />

  if (!data || data.assets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Reliability metrics (MTTR / MTBF)</h2>
        <p className="text-sm text-gray-400 text-center py-8">No completed breakdown work orders with timing data yet.</p>
      </div>
    )
  }

  const { assets, summary } = data

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">Reliability metrics — MTTR &amp; MTBF</h2>
      </div>

      {/* Fleet summary */}
      <div className="grid grid-cols-4 gap-0 border-b border-gray-100">
        {[
          { label: 'Assets tracked',  value: summary.totalAssets,                  sub: 'with failure history' },
          { label: 'Total failures',   value: summary.totalFailures,                sub: 'breakdown WOs' },
          { label: 'Fleet avg MTTR',   value: `${summary.fleetAvgMTTR}h`,           sub: 'mean time to repair' },
          { label: 'Fleet avg MTBF',   value: summary.fleetAvgMTBF > 0 ? `${summary.fleetAvgMTBF}d` : '—', sub: 'mean time between failures' },
        ].map((s, i) => (
          <div key={i} className={`px-5 py-4 ${i > 0 ? 'border-l border-gray-100' : ''}`}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-asset table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Failures</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">MTTR (hrs)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">MTBF (days)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Labor hrs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {assets.map(a => (
              <tr key={a.assetId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/assets/${a.assetId}`} className="font-medium text-blue-600 hover:underline">{a.assetName}</Link>
                  <p className="text-xs text-gray-400 font-mono">{a.assetCode}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`badge ${badge(a.failureCount, 3, false)}`}>{a.failureCount}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`badge ${badge(a.avgMTTR, 4, false)}`}>{a.avgMTTR}h</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {a.avgMTBF > 0
                    ? <span className={`badge ${badge(a.avgMTBF, 30, true)}`}>{a.avgMTBF}d</span>
                    : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{a.totalLaborHours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
        MTTR = avg hours from start to close · MTBF = avg days between failures · Based on breakdown WOs only
      </p>
    </div>
  )
}