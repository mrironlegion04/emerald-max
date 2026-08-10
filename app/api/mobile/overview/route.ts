import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { buildLocationFilter, buildWOVisibilityFilter, getUserLocationIds } from '@/lib/access-control'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.teamMember.findMany({
    where: { userId: user.userId },
    select: { teamId: true },
  })
  const teamIds = memberships.map(m => m.teamId)
  const visibilityFilter = await buildWOVisibilityFilter(user)
  const visAnd = visibilityFilter ? [visibilityFilter] : []
  const locationFilter = await buildLocationFilter(user)

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const teamFilter = teamIds.length ? { teamId: { in: teamIds } } : undefined
  const myOrTeam = teamIds.length
    ? [{ assignedToId: user.userId }, { teamId: { in: teamIds } }]
    : [{ assignedToId: user.userId }]

  // Recent activity must not leak entity names from other plants
  let recentActivityWhere: any = { createdAt: { gte: sevenDaysAgo } }
  if (user.role !== 'ADMIN') {
    const visibleWOIds = await prisma.workOrder.findMany({
      where: { AND: visAnd },
      select: { id: true },
    }).then(rows => rows.map(r => r.id))
    const visibleAssetIds = locationFilter
      ? await prisma.asset.findMany({ where: { ...locationFilter }, select: { id: true } }).then(rows => rows.map(r => r.id))
      : null
    const visiblePmIds = locationFilter
      ? await prisma.maintenanceSchedule.findMany({ where: { ...locationFilter }, select: { id: true } }).then(rows => rows.map(r => r.id))
      : null
    const visibleLocationIds = await getUserLocationIds(user.userId)

    const activityOrs: any[] = [
      { userId: user.userId },
      { entity: 'Work Order',  entityId: { in: visibleWOIds } },
      { entity: 'WorkOrder',   entityId: { in: visibleWOIds } },
    ]
    if (visibleAssetIds) activityOrs.push({ entity: 'Asset', entityId: { in: visibleAssetIds } })
    if (visiblePmIds)    activityOrs.push({ entity: 'MaintenanceSchedule', entityId: { in: visiblePmIds } })
    if (visibleLocationIds) activityOrs.push({ entity: 'Location', entityId: { in: visibleLocationIds } })
    recentActivityWhere = { createdAt: { gte: sevenDaysAgo }, OR: activityOrs }
  }

  const [
    highPriorityWOs,
    overdueWOs,
    pendingRequests,
    completedLast7Days,
    myAssignedWOs,
    teamWOs,
    unassignedWOs,
    recentActivity,
    totalOpen,
  ] = await Promise.all([
    // High priority WOs assigned to user or their domain
    prisma.workOrder.findMany({
      where: {
        AND: visAnd,
        priority: { in: ['HIGH', 'CRITICAL'] },
        status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
        OR: myOrTeam,
      },
      select: {
        id: true, woNumber: true, title: true, priority: true, status: true, dueDate: true,
        asset: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 10,
    }),
    // Overdue WOs assigned to user or their team
    prisma.workOrder.findMany({
      where: {
        AND: visAnd,
        status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
        dueDate: { lt: now },
        OR: myOrTeam,
      },
      select: {
        id: true, woNumber: true, title: true, priority: true, status: true, dueDate: true,
        asset: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    // Pending approval work orders
    prisma.workOrder.count({
      where: { AND: visAnd, status: 'PENDING_APPROVAL' },
    }),
    // Completed in last 7 days (assigned to user or their team)
    prisma.workOrder.findMany({
      where: {
        AND: visAnd,
        status: { in: ['COMPLETED', 'CLOSED'] },
        completedAt: { gte: sevenDaysAgo },
        OR: myOrTeam,
      },
      select: {
        id: true, woNumber: true, title: true, priority: true, completedAt: true,
        asset: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
    // TO-DO: Assigned to me
    prisma.workOrder.findMany({
      where: {
        AND: visAnd,
        assignedToId: user.userId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: {
        id: true, woNumber: true, title: true, priority: true, status: true, dueDate: true,
        asset: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 10,
    }),
    // TO-DO: Assigned to my teams
    prisma.workOrder.findMany({
      where: {
        AND: visAnd,
        ...(teamFilter && { OR: [teamFilter] }),
        assignedToId: { not: user.userId },
        status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: {
        id: true, woNumber: true, title: true, priority: true, status: true, dueDate: true,
        assignedTo: { select: { name: true } },
        asset: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 10,
    }),
    // TO-DO: Unassigned / everything else
    prisma.workOrder.findMany({
      where: {
        AND: visAnd,
        assignedToId: null,
        status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: {
        id: true, woNumber: true, title: true, priority: true, status: true, dueDate: true,
        asset: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    // Recent activity (audit log)
    prisma.auditLog.findMany({
      where: recentActivityWhere,
      select: {
        id: true, action: true, entity: true, entityName: true, createdAt: true, userName: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    // Total open WOs count
    prisma.workOrder.count({
      where: { AND: visAnd, status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } },
    }),
  ])

  return NextResponse.json({
   WOStats: {
      highPriority: highPriorityWOs.length,
      overdue: overdueWOs.length,
      pendingApprovals: pendingRequests,
      completedLast7Days: completedLast7Days.length,
      totalOpen,
    },
    highPriorityWOs,
    overdueWOs,
    completedLast7Days,
    myAssignedWOs,
    teamWOs,
    unassignedWOs,
    recentActivity: recentActivity.map(a => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityName: a.entityName,
      userName: a.userName ?? 'System',
      createdAt: a.createdAt,
    })),
  })
}
