'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Clock, CheckCircle, QrCode, MessageCircle,
  ChevronRight, Shield, Bell, Users,
} from 'lucide-react'
import Badge, { priorityVariant } from './Badge'

interface WO {
  id: string; woNumber: string; title: string; priority: string; status: string
  dueDate: string | null; asset?: { name: string } | null; assignedTo?: { name: string } | null
}

interface Activity {
  id: string; action: string; entity: string; entityName: string
  userName: string; createdAt: string
}

interface Data {
  WOStats: {
    highPriority: number; overdue: number; pendingApprovals: number
    completedLast7Days: number; totalOpen: number
  }
  highPriorityWOs: WO[]; overdueWOs: WO[]; completedLast7Days: WO[]
  myAssignedWOs: WO[]; teamWOs: WO[]; unassignedWOs: WO[]
  recentActivity: Activity[]
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    CREATE: 'created', UPDATE: 'updated', DELETE: 'deleted',
    COMPLETE: 'completed', ASSIGN: 'assigned', STATUS_CHANGE: 'changed status on',
  }
  return map[a] ?? a.toLowerCase()
}

export default function MobileOverview({ userName }: { userName: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [todoTab, setTodoTab] = useState<'me' | 'team' | 'all'>('me')

  useEffect(() => {
    fetch('/api/mobile/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const todoList = todoTab === 'me' ? data.myAssignedWOs : todoTab === 'team' ? data.teamWOs : data.unassignedWOs

  return (
    <div className="p-5 pb-28 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-900">{greeting}, {userName}</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">{data.WOStats.totalOpen} open work orders</p>
      </div>

      {/* Shortcut bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { label: 'Scan', icon: QrCode, href: '/scan', color: 'bg-slate-900 text-white' },
          { label: 'Due Today', icon: Clock, href: '/work-orders?dueDateFrom=' + new Date().toISOString().split('T')[0] + '&dueDateTo=' + new Date().toISOString().split('T')[0], color: 'bg-blue-50 text-blue-600' },
          { label: 'Messages', icon: MessageCircle, href: '/messages', color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Requests', icon: Bell, href: '/requests', color: 'bg-amber-50 text-amber-600' },
        ].map(s => (
          <Link key={s.label} href={s.href}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${s.color} flex-shrink-0`}>
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </Link>
        ))}
      </div>

      {/* WO Status cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/work-orders?priority=HIGH&priority=CRITICAL" className="bg-white rounded-xl border border-slate-200/80 p-3.5 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">{data.WOStats.highPriority}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">High Priority</p>
        </Link>
        <Link href="/work-orders?overdue=true" className="bg-white rounded-xl border border-slate-200/80 p-3.5 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-red-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-red-600">{data.WOStats.overdue}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Overdue</p>
        </Link>
        <Link href="/requests" className="bg-white rounded-xl border border-slate-200/80 p-3.5 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">{data.WOStats.pendingApprovals}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
        </Link>
        <Link href="/work-orders?status=COMPLETED" className="bg-white rounded-xl border border-slate-200/80 p-3.5 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-600">{data.WOStats.completedLast7Days}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Done (7 days)</p>
        </Link>
      </div>

      {/* To-Do List */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { key: 'me' as const, label: 'Assigned to Me', count: data.myAssignedWOs.length },
            { key: 'team' as const, label: 'My Team', count: data.teamWOs.length },
            { key: 'all' as const, label: 'Unassigned', count: data.unassignedWOs.length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setTodoTab(tab.key)}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                todoTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${
                  todoTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
          {todoList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">All clear!</div>
          ) : (
            todoList.map(wo => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{wo.title}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {wo.woNumber}{wo.asset ? ` · ${wo.asset.name}` : ''}
                    {wo.assignedTo ? ` · ${wo.assignedTo.name}` : ''}
                  </p>
                </div>
                <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
              </Link>
            ))
          )}
        </div>
        <Link href="/work-orders" className="flex items-center justify-center py-2.5 text-xs font-bold text-blue-600 border-t border-slate-100 active:bg-slate-50">
          View all work orders <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Link>
      </div>

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Activity</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {data.recentActivity.map(a => (
              <div key={a.id} className="px-4 py-2.5 flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="w-3 h-3 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800">{a.userName}</span>{' '}
                    {actionLabel(a.action)}{' '}
                    <span className="font-bold text-slate-800">{a.entityName}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
