import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import Badge, { workOrderStatusVariant, priorityVariant } from '@/components/Badge'
import Link from 'next/link'
import { Building2, ClipboardList, Clock, CheckCircle, Users } from 'lucide-react'

interface RecentWO {
  id: string
  title: string
  woNumber: string
  priority: string
  status: string
  asset?: { name: string } | null
  team?: { name: string } | null
  assignedTo?: { name: string } | null
}

async function getDashboardStats() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    totalAssets, activeAssets,
    openWOs, inProgressWOs, overdueWOs, completedThisMonth,
    recentWorkOrders, criticalWorkOrders,
    overduePM, dueSoonPM,
    totalTeams, teamWorkOrders,
  ] = await Promise.all([
    prisma.asset.count({ where: { isDeleted: false } }),
    prisma.asset.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
    prisma.workOrder.count({ where: { status: 'OPEN' } }),
    prisma.workOrder.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.workOrder.count({
      where: { status: { in: ['OPEN','IN_PROGRESS'] }, dueDate: { lt: now } },
    }),
    prisma.workOrder.count({
      where: { status: 'COMPLETED', completedAt: { gte: monthStart } },
    }),
    prisma.workOrder.findMany({
      take: 8, orderBy: { createdAt: 'desc' },
      include: {
        asset:      { select: { name: true } },
        assignedTo: { select: { name: true } },
        team:       { select: { name: true } },
      },
    }),
    prisma.workOrder.findMany({
      where: { priority: 'CRITICAL', status: { in: ['OPEN','IN_PROGRESS'] } },
      take: 5, orderBy: { createdAt: 'desc' },
      include: { asset: { select: { name: true } } },
    }),
    // Overdue PM schedules
    prisma.maintenanceSchedule.findMany({
      where: { isActive: true, nextDueDate: { lt: now } },
      include: {
        asset: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: 'asc' },
      take: 5,
    }),
    // Due within 7 days
    prisma.maintenanceSchedule.findMany({
      where: { isActive: true, nextDueDate: { gte: now, lte: in7days } },
      include: {
        asset: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: 'asc' },
      take: 5,
    }),
    prisma.team.count({ where: { isDeleted: false } }),
    prisma.workOrder.groupBy({
      by: ['teamId'],
      where: { teamId: { not: null } },
      _count: true,
    }),
  ])

  return {
    totalAssets, activeAssets, openWOs, inProgressWOs, overdueWOs,
    completedThisMonth, recentWorkOrders, criticalWorkOrders, lowStockParts: [],
    overduePM, dueSoonPM, totalTeams, teamWorkOrders,
  }
}

function fmt(date: Date | null) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

function daysAgo(date: Date | string) {
  return Math.abs(Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default async function DashboardPage() {
  const user  = await getCurrentUser()
  const stats = await getDashboardStats()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={`Good ${getTimeOfDay()}, ${user?.name.split(' ')[0]}`}
        subtitle="Here's what's happening with your maintenance operations today."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard title="Total assets" value={stats.totalAssets}
          subtitle={`${stats.activeAssets} active`} color="blue"
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard title="Open work orders" value={stats.openWOs + stats.inProgressWOs}
          subtitle={`${stats.inProgressWOs} in progress`} color="yellow"
          icon={<ClipboardList className="w-5 h-5" />}
        />
        <StatCard title="Overdue WOs" value={stats.overdueWOs}
          subtitle="past due date" color={stats.overdueWOs > 0 ? 'red' : 'green'}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard title="Completed this month" value={stats.completedThisMonth}
          subtitle="work orders closed" color="green"
          icon={<CheckCircle className="w-5 h-5" />}
        />
      </div>

      {/* Team stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard title="Teams" value={stats.totalTeams}
          subtitle="active trade teams" color="purple"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard title="Team WOs" value={stats.teamWorkOrders.length}
          subtitle="assigned to teams" color="purple"
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent WOs — spans 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent work orders</h2>
            <Link href="/work-orders" className="text-xs text-blue-600 hover:underline font-medium">View all</Link>
          </div>
          {stats.recentWorkOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No work orders yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.recentWorkOrders.map((wo: RecentWO) => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {wo.woNumber}{wo.asset ? ` · ${wo.asset.name}` : ''}{wo.team ? ` · 👥 ${wo.team.name}` : wo.assignedTo ? ` · ${wo.assignedTo.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
                    <Badge label={wo.status.replace('_',' ')} variant={workOrderStatusVariant(wo.status)} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* PM alerts */}
          {(stats.overduePM.length > 0 || stats.dueSoonPM.length > 0) && (
            <div className="bg-white rounded-xl border border-orange-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-orange-100">
                <h2 className="font-semibold text-gray-900 text-sm">PM alerts</h2>
                <Link href="/preventive-maintenance" className="text-xs text-blue-600 hover:underline font-medium">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {stats.overduePM.map((pm: any) => {
                  const targetName = pm.asset?.name ?? pm.location?.name ?? 'General'
                  return (
                    <Link key={pm.id} href={`/preventive-maintenance/${pm.id}`}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{pm.title}</p>
                        <p className="text-xs text-red-500">{targetName} · {daysAgo(pm.nextDueDate)}d overdue</p>
                      </div>
                    </Link>
                  )
                })}
                {stats.dueSoonPM.map((pm: any) => {
                  const targetName = pm.asset?.name ?? pm.location?.name ?? 'General'
                  return (
                    <Link key={pm.id} href={`/preventive-maintenance/${pm.id}`}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{pm.title}</p>
                        <p className="text-xs text-yellow-600">{targetName} · Due {fmt(pm.nextDueDate)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Critical WOs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Critical & urgent</h2>
              {stats.criticalWorkOrders.length > 0 && (
                <span className="badge bg-red-100 text-red-700">{stats.criticalWorkOrders.length}</span>
              )}
            </div>
            {stats.criticalWorkOrders.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No critical items</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.criticalWorkOrders.map((wo: any) => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                      <p className="text-xs text-gray-400">{wo.asset?.name ?? 'No asset'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  )
}
