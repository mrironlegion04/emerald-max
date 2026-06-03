export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import {
  CheckCircle2, Clock, AlertCircle, Zap, Check,
  ListChecks, Users, Inbox, ArrowRight, CalendarDays,
  UserCircle2, Package,
} from 'lucide-react'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(date: Date | string | null) {
  if (!date) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(date))
}

function getUrgencyBucket(dueDate: Date | null): 'overdue' | 'today' | 'thisWeek' | 'later' | 'none' {
  if (!dueDate) return 'none'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const d = new Date(dueDate)
  const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (normalized < today) return 'overdue'
  if (normalized.getTime() === today.getTime()) return 'today'
  if (normalized <= weekEnd) return 'thisWeek'
  return 'later'
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WO {
  id: string
  woNumber: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  asset: { id: string; name: string; assetCode: string | null } | null
  assignedTo: { id: string; name: string } | null
  team: { id: string; name: string } | null
}

interface ST {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  assignedTo: { id: string; name: string } | null
  assignedTeam: { id: string; name: string } | null
  workOrder: {
    id: string
    woNumber: string
    title: string
    status: string
    dueDate: Date | null
    asset: { id: string; name: string; assetCode: string | null } | null
  }
}

type UrgencyBucket = 'overdue' | 'today' | 'thisWeek' | 'later' | 'none'

interface Categorized<T> {
  overdue: T[]
  today: T[]
  thisWeek: T[]
  later: T[]
  none: T[]
}

function categorize<T extends { dueDate: Date | null }>(items: T[]): Categorized<T> {
  const out: Categorized<T> = { overdue: [], today: [], thisWeek: [], later: [], none: [] }
  for (const item of items) {
    out[getUrgencyBucket(item.dueDate)].push(item)
  }
  return out
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const statusVariant = (s: string): 'yellow' | 'blue' | 'orange' | 'green' | 'gray' =>
  ({ OPEN: 'yellow', IN_PROGRESS: 'blue', ON_HOLD: 'orange', COMPLETED: 'green', CANCELLED: 'gray', PENDING: 'yellow' }[s] as never) ?? 'gray'

const priorityVariant = (p: string): 'red' | 'orange' | 'yellow' | 'blue' | 'gray' =>
  ({ CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'yellow', LOW: 'blue' }[p] as never) ?? 'gray'

// ── Constants ─────────────────────────────────────────────────────────────────

const OPEN_POOL_PREVIEW = 9

const URGENCY_CONFIG: Record<UrgencyBucket, { label: string; dot: string; headerCls: string }> = {
  overdue:  { label: 'Overdue',     dot: 'bg-red-500',    headerCls: 'text-red-700 bg-red-50 border-red-200' },
  today:    { label: 'Due Today',   dot: 'bg-orange-500', headerCls: 'text-orange-700 bg-orange-50 border-orange-200' },
  thisWeek: { label: 'This Week',   dot: 'bg-yellow-500', headerCls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  later:    { label: 'Later',       dot: 'bg-blue-400',   headerCls: 'text-blue-700 bg-blue-50 border-blue-200' },
  none:     { label: 'No Due Date', dot: 'bg-gray-300',   headerCls: 'text-gray-600 bg-gray-50 border-gray-200' },
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════════════

export default async function ToDoPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const userWithTeam = await prisma.user.findUnique({
    where: { id: user.userId },
    include: {
      teamMembers: { include: { team: { select: { id: true, name: true } } } },
    },
  })
  if (!userWithTeam) redirect('/login')

  const userTeams = userWithTeam.teamMembers.map((tm: any) => ({ id: tm.team.id, name: tm.team.name }))
  const userTeamIds = userTeams.map((t: any) => t.id)

  const woOrder = [{ priority: 'desc' as const }, { dueDate: 'asc' as const }]

  // ── Active statuses ───────────────────────────────────────────────────────
  // NOTE: using typed arrays to ensure proper compatibility with Prisma types
  const ACTIVE_WO: any[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']
  const ACTIVE_ST: any[]   = ['PENDING', 'IN_PROGRESS']

  // ════════════════════════════════════════════════════════════════════════
  // ① MY WOs — directly assigned to me personally
  // ════════════════════════════════════════════════════════════════════════
  const myWOs = await prisma.workOrder.findMany({
    where: {
      assignedToId: user.userId,
      status: { in: ACTIVE_WO },
    },
    include: {
      asset:      { select: { id: true, name: true, assetCode: true } },
      assignedTo: { select: { id: true, name: true } },
      team:       { select: { id: true, name: true } },
    },
    orderBy: woOrder,
  })

  // ════════════════════════════════════════════════════════════════════════
  // ② MY SUBTASKS — directly assigned to me personally (not via team)
  // ════════════════════════════════════════════════════════════════════════
  const mySubtasks = await prisma.subtask.findMany({
    where: {
      assignedToId: user.userId,
      status: { in: ACTIVE_ST },
    },
    include: {
      assignedTo:   { select: { id: true, name: true } },
      assignedTeam: { select: { id: true, name: true } },
      workOrder: {
        select: {
          id: true, woNumber: true, title: true, status: true, dueDate: true,
          asset: { select: { id: true, name: true, assetCode: true } },
        },
      },
    },
    orderBy: woOrder,
  })

  // ════════════════════════════════════════════════════════════════════════
  // ③ TEAM WOs — teamId is one of my teams, and I am NOT the sole assignee
  //
  //   KEY FIX: We fetch ALL WOs for my teams (regardless of assignedToId),
  //   then in JS we exclude the ones already in myWOs by ID.
  //   This avoids any Prisma NULL-comparison weirdness entirely.
  // ════════════════════════════════════════════════════════════════════════
  const rawTeamWOs = userTeamIds.length > 0
    ? await prisma.workOrder.findMany({
        where: {
          teamId: { in: userTeamIds },
          status: { in: ACTIVE_WO },
        },
        include: {
          asset:      { select: { id: true, name: true, assetCode: true } },
          assignedTo: { select: { id: true, name: true } },
          team:       { select: { id: true, name: true } },
        },
        orderBy: woOrder,
      })
    : []

  // Exclude WOs that are already in "My Tasks" (assigned personally to me)
  const myWOIds = new Set(myWOs.map((w: any) => w.id))
  const teamWOs = rawTeamWOs.filter((wo: any) => !myWOIds.has(wo.id))

  // ════════════════════════════════════════════════════════════════════════
  // ④ TEAM SUBTASKS — assignedTeamId is one of my teams
  //
  //   KEY FIX: Same approach — fetch all, exclude mine by ID in JS.
  //   This is the fix for subtasks with assignedToId=null disappearing.
  // ════════════════════════════════════════════════════════════════════════
  const rawTeamSubtasks = userTeamIds.length > 0
    ? await prisma.subtask.findMany({
        where: {
          assignedTeamId: { in: userTeamIds },
          status: { in: ACTIVE_ST },
        },
        include: {
          assignedTo:   { select: { id: true, name: true } },
          assignedTeam: { select: { id: true, name: true } },
          workOrder: {
            select: {
              id: true, woNumber: true, title: true, status: true, dueDate: true,
              asset: { select: { id: true, name: true, assetCode: true } },
            },
          },
        },
        orderBy: woOrder,
      })
    : []

  // Exclude subtasks already in "My Subtasks"
  const mySTIds = new Set(mySubtasks.map((s: any) => s.id))
  const teamSubtasks = rawTeamSubtasks.filter((st: any) => !mySTIds.has(st.id))

  // ════════════════════════════════════════════════════════════════════════
  // ⑤ OPEN POOL — no assignee, not in any of my teams
  // ════════════════════════════════════════════════════════════════════════
  const openPoolWhere = {
    assignedToId: null,
    status: { in: ['OPEN', 'IN_PROGRESS'] as any[] },
    ...(userTeamIds.length > 0
      ? {
          OR: [
            { teamId: null },
            { teamId: { notIn: userTeamIds } },
          ],
        }
      : {}),
  }
  const [openPoolWOs, openPoolTotal] = await Promise.all([
    prisma.workOrder.findMany({
      where: openPoolWhere,
      include: {
        asset:      { select: { id: true, name: true, assetCode: true } },
        assignedTo: { select: { id: true, name: true } },
        team:       { select: { id: true, name: true } },
      },
      orderBy: woOrder,
      take: OPEN_POOL_PREVIEW,
    }),
    prisma.workOrder.count({ where: openPoolWhere }),
  ])

  // ════════════════════════════════════════════════════════════════════════
  // ⑥ RECENTLY COMPLETED — assigned to me or completed by me
  // ════════════════════════════════════════════════════════════════════════
  const myCompletedWOs = await prisma.workOrder.findMany({
    where: {
      status: 'COMPLETED',
      OR: [
        { assignedToId: user.userId },
        { completedById: user.userId },
      ],
    },
    include: {
      asset:      { select: { id: true, name: true, assetCode: true } },
      assignedTo: { select: { id: true, name: true } },
      team:       { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 9,
  })

  // ── Group per-team ─────────────────────────────────────────────────────
  const teamSections = userTeams.map((team: any) => ({
    team,
    wos:      teamWOs.filter((wo: any) => wo.team?.id === team.id),
    subtasks: teamSubtasks.filter((st: any) => st.assignedTeam?.id === team.id),
  }))

  // ── Stats ──────────────────────────────────────────────────────────────
  const myWOCat = categorize(myWOs)
  const mySTCat = categorize(mySubtasks)
  const myOverdue  = myWOCat.overdue.length + mySTCat.overdue.length
  const myTotal    = myWOs.length + mySubtasks.length

  const teamTotal   = teamWOs.length + teamSubtasks.length
  const teamOverdue = teamSections.reduce((acc: number, ts: any) => {
    const wC = categorize(ts.wos)
    const sC = categorize(ts.subtasks)
    return acc + wC.overdue.length + sC.overdue.length
  }, 0)

  const hasMoreOpen = openPoolTotal > openPoolWOs.length

  // ════════════════════════════════════════════════════════════════════════
  // RENDER HELPERS (defined inside so they close over nothing — pure)
  // ════════════════════════════════════════════════════════════════════════

  function WOCard({ wo }: { wo: WO }) {
    const bucket    = getUrgencyBucket(wo.dueDate)
    const isOverdue = bucket === 'overdue'
    const isToday   = bucket === 'today'
    const borderCls = isOverdue
      ? 'border-red-200 bg-red-50/60'
      : isToday
        ? 'border-orange-200 bg-orange-50/60'
        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/20'

    return (
      <Link
        href={`/work-orders/${wo.id}`}
        className={`group flex flex-col rounded-xl border p-4 gap-3 transition-all hover:shadow-sm ${borderCls}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-gray-400 shrink-0">{wo.woNumber}</span>
              {isOverdue && <Pill color="red"    label="Overdue"   />}
              {isToday   && <Pill color="orange" label="Due Today" />}
            </div>
            <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
              {wo.title}
            </p>
          </div>
          <PriorityDot priority={wo.priority} />
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge label={wo.status.replace('_', ' ')} variant={statusVariant(wo.status)} />
          <Badge label={wo.priority}                 variant={priorityVariant(wo.priority)} />
        </div>

        <div className="space-y-1">
          {wo.asset && (
            <MetaRow icon={<Package className="w-3.5 h-3.5" />}
              text={`${wo.asset.name}${wo.asset.assetCode ? ` · ${wo.asset.assetCode}` : ''}`} />
          )}
          {wo.assignedTo
            ? <MetaRow icon={<UserCircle2 className="w-3.5 h-3.5" />} text={wo.assignedTo.name} />
            : <MetaRow icon={<Inbox className="w-3.5 h-3.5 text-amber-400" />} text="Unassigned" muted />
          }
          {wo.team && (
            <MetaRow icon={<Users className="w-3.5 h-3.5" />} text={wo.team.name} muted />
          )}
        </div>

        <div className={`flex items-center justify-between pt-2 border-t ${isOverdue ? 'border-red-200' : isToday ? 'border-orange-200' : 'border-gray-100'}`}>
          <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-gray-400'}`}>
            {wo.dueDate
              ? <><CalendarDays className="w-3 h-3" />{fmtDate(wo.dueDate)}</>
              : <span className="text-gray-300">No due date</span>
            }
          </span>
          <span className="text-[11px] text-blue-500 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </Link>
    )
  }

  function SubtaskCard({ st }: { st: ST }) {
    // Use subtask's own dueDate; fall back to parent WO dueDate if subtask has none
    const effectiveDue = st.dueDate ?? st.workOrder.dueDate
    const bucket    = getUrgencyBucket(effectiveDue)
    const isOverdue = bucket === 'overdue'
    const isToday   = bucket === 'today'
    const borderCls = isOverdue
      ? 'border-red-200 bg-red-50/60'
      : isToday
        ? 'border-orange-200 bg-orange-50/60'
        : 'border-violet-100 bg-violet-50/30 hover:border-violet-300 hover:bg-violet-50/60'

    return (
      <Link
        href={`/work-orders/${st.workOrder.id}`}
        className={`group flex flex-col rounded-xl border p-4 gap-3 transition-all hover:shadow-sm ${borderCls}`}
      >
        {/* Subtask indicator row */}
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-[11px] font-bold text-violet-500 uppercase tracking-wide">Subtask</span>
          <span className="text-[11px] font-mono text-gray-400 ml-auto shrink-0">{st.workOrder.woNumber}</span>
        </div>

        {/* Title + parent WO */}
        <div className="space-y-0.5">
          <div className="flex items-start gap-2">
            <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors flex-1">
              {st.title}
            </p>
            <PriorityDot priority={st.priority} />
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            in: <span className="text-gray-500">{st.workOrder.title}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge label={st.status.replace('_', ' ')} variant={statusVariant(st.status)} />
          <Badge label={st.priority}                 variant={priorityVariant(st.priority)} />
          {isOverdue && <Pill color="red"    label="Overdue"   />}
          {isToday   && <Pill color="orange" label="Due Today" />}
        </div>

        <div className="space-y-1">
          {st.workOrder.asset && (
            <MetaRow icon={<Package className="w-3.5 h-3.5" />} text={st.workOrder.asset.name} />
          )}
          {st.assignedTo && (
            <MetaRow icon={<UserCircle2 className="w-3.5 h-3.5" />} text={st.assignedTo.name} />
          )}
          {st.assignedTeam && (
            <MetaRow icon={<Users className="w-3.5 h-3.5 text-violet-400" />}
              text={`${st.assignedTeam.name}${st.assignedTo ? '' : ' (team)'}`} />
          )}
        </div>

        <div className={`flex items-center justify-between pt-2 border-t ${isOverdue ? 'border-red-200' : isToday ? 'border-orange-200' : 'border-violet-100'}`}>
          <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-gray-400'}`}>
            {effectiveDue
              ? <><CalendarDays className="w-3 h-3" />{fmtDate(effectiveDue)}{!st.dueDate && <span className="ml-1 text-gray-300">(from WO)</span>}</>
              : <span className="text-gray-300">No due date</span>
            }
          </span>
          <span className="text-[11px] text-violet-500 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            View WO <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </Link>
    )
  }

  function UrgencySection({ wos, subtasks }: { wos: WO[]; subtasks: ST[] }) {
    const woCat = categorize(wos)
    // For subtasks, bucket by effective due date (own OR parent WO)
    const stWithEffective = subtasks.map((st) => ({ ...st, dueDate: st.dueDate ?? st.workOrder.dueDate }))
    const stCat = categorize(stWithEffective)

    const buckets: UrgencyBucket[] = ['overdue', 'today', 'thisWeek', 'later', 'none']
    const nonEmpty = buckets.filter((b) => woCat[b].length > 0 || stCat[b].length > 0)
    if (nonEmpty.length === 0) return null

    return (
      <div className="space-y-5">
        {nonEmpty.map((bucket) => {
          const cfg  = URGENCY_CONFIG[bucket]
          const bWOs = woCat[bucket]
          // Map back to original subtasks for this bucket
          const bSTsEffective = stCat[bucket]
          const bSTs = bSTsEffective.map((s) => subtasks.find((orig) => orig.id === s.id)!).filter(Boolean)
          const total = bWOs.length + bSTs.length
          return (
            <div key={bucket}>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold mb-3 ${cfg.headerCls}`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
                <span className="font-normal opacity-60">({total})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bWOs.map((wo) => <WOCard key={wo.id} wo={wo} />)}
                {bSTs.map((st) => <SubtaskCard key={st.id} st={st} />)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // JSX
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      <PageHeader title="To Do" subtitle="Your assigned work orders, subtasks, and team queue" />

      {/* ── Top stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <TopStat label="My Tasks"    value={myTotal}       sub={myOverdue > 0 ? `${myOverdue} overdue` : 'all good'}         subColor={myOverdue > 0 ? 'text-red-500' : 'text-green-500'}   color="blue"   icon={<UserCircle2 className="w-5 h-5" />} />
        {userTeams.length > 0 && (
          <TopStat label={userTeams.length === 1 ? userTeams[0].name : `${userTeams.length} Teams`}
            value={teamTotal}
            sub={teamOverdue > 0 ? `${teamOverdue} overdue` : 'all good'}
            subColor={teamOverdue > 0 ? 'text-red-500' : 'text-green-500'}
            color="violet"
            icon={<Users className="w-5 h-5" />}
          />
        )}
        <TopStat label="Open Pool"   value={openPoolTotal} sub="available"     subColor="text-gray-400"                       color="amber"  icon={<Inbox className="w-5 h-5" />} />
        <TopStat label="Completed"   value={myCompletedWOs.length} sub="recently" subColor="text-gray-400"                   color="green"  icon={<Check className="w-5 h-5" />} />
        <TopStat label="Overdue"     value={myOverdue + teamOverdue}
          sub={myOverdue + teamOverdue > 0 ? 'needs attention' : 'none'}
          subColor={myOverdue + teamOverdue > 0 ? 'text-red-500' : 'text-green-500'}
          color="red"
          icon={<AlertCircle className="w-5 h-5" />}
        />
      </div>

      {/* ══ SECTION 1: MY TASKS ══ */}
      <Section
        icon={<UserCircle2 className="w-5 h-5 text-blue-600" />}
        iconBg="bg-blue-100"
        title="My Tasks"
        subtitle={`${myTotal} item${myTotal !== 1 ? 's' : ''} assigned directly to you`}
        overdueCount={myOverdue}
        viewAll={{ href: `/work-orders?assignedToId=${user.userId}`, label: 'View all my WOs' }}
      >
        {myTotal === 0 ? (
          <EmptyBox icon={<CheckCircle2 className="w-8 h-8 text-blue-300" />}
            title="You're all caught up!" subtitle="No work orders or subtasks assigned to you." color="blue" />
        ) : (
          <UrgencySection wos={myWOs} subtasks={mySubtasks} />
        )}
      </Section>

      {/* ══ SECTION 2: ONE SECTION PER TEAM ══ */}
      {teamSections.map(({ team, wos, subtasks }: any) => {
        const wC = categorize(wos)
        const sC = categorize(subtasks.map((s: any) => ({ ...s, dueDate: s.dueDate ?? s.workOrder.dueDate })))
        const secOverdue = wC.overdue.length + sC.overdue.length
        const secTotal   = wos.length + subtasks.length
        return (
          <Section
            key={team.id}
            icon={<Users className="w-5 h-5 text-violet-600" />}
            iconBg="bg-violet-100"
            title={team.name}
            subtitle={`${secTotal} item${secTotal !== 1 ? 's' : ''} in team queue`}
            overdueCount={secOverdue}
            viewAll={{ href: `/work-orders?teamId=${team.id}`, label: 'View team WOs' }}
          >
            {secTotal === 0 ? (
              <EmptyBox icon={<Users className="w-8 h-8 text-violet-300" />}
                title="Team queue is clear!" subtitle="No active work orders or subtasks for this team." color="violet" />
            ) : (
              <UrgencySection wos={wos} subtasks={subtasks} />
            )}
          </Section>
        )
      })}

      {/* ══ SECTION 3: OPEN POOL ══ */}
      <Section
        icon={<Inbox className="w-5 h-5 text-amber-600" />}
        iconBg="bg-amber-100"
        title="Open Pool"
        subtitle={`${openPoolTotal} unassigned work order${openPoolTotal !== 1 ? 's' : ''} available to pick up`}
        viewAll={hasMoreOpen ? { href: '/work-orders?status=OPEN', label: `View all ${openPoolTotal}` } : undefined}
      >
        {openPoolTotal === 0 ? (
          <EmptyBox icon={<Inbox className="w-8 h-8 text-amber-300" />}
            title="Open pool is empty" subtitle="All available work orders have been assigned." color="amber" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {openPoolWOs.map((wo: any) => <WOCard key={wo.id} wo={wo} />)}
            </div>
            {hasMoreOpen && (
              <div className="mt-5 flex justify-center">
                <Link href="/work-orders?status=OPEN"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-sm">
                  <Inbox className="w-4 h-4" />
                  View all {openPoolTotal} open work orders
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ══ SECTION 4: RECENTLY COMPLETED ══ */}
      {myCompletedWOs.length > 0 && (
        <Section
          icon={<Check className="w-5 h-5 text-green-600" />}
          iconBg="bg-green-100"
          title="Recently Completed"
          subtitle="Last 9 work orders you completed or were assigned"
          viewAll={{ href: `/work-orders?status=COMPLETED&assignedToId=${user.userId}`, label: 'View all completed' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myCompletedWOs.map((wo: any) => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}
                className="group flex flex-col rounded-xl border border-green-200 bg-green-50/40 p-4 gap-3 hover:shadow-sm transition-all opacity-80 hover:opacity-100">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-gray-400">{wo.woNumber}</span>
                  <Badge label="COMPLETED" variant="green" />
                </div>
                <p className="font-semibold text-gray-600 text-sm line-clamp-2 line-through group-hover:text-green-700 transition-colors">
                  {wo.title}
                </p>
                <div className="space-y-1">
                  {wo.asset && <MetaRow icon={<Package className="w-3.5 h-3.5" />} text={wo.asset.name} />}
                  {wo.team  && <MetaRow icon={<Users   className="w-3.5 h-3.5" />} text={wo.team.name} />}
                </div>
                <div className="pt-2 border-t border-green-200 mt-auto flex items-center justify-between">
                  <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </span>
                  <span className="text-[11px] text-green-500 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Section({
  icon, iconBg, title, subtitle, overdueCount, viewAll, children,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  overdueCount?: number
  viewAll?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gray-900 leading-none">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5 leading-none">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {overdueCount !== undefined && overdueCount > 0 && (
            <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
              {overdueCount} overdue
            </span>
          )}
          {viewAll && (
            <Link href={viewAll.href}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors">
              {viewAll.label} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function TopStat({ label, value, sub, subColor, color, icon }: {
  label: string; value: number; sub: string; subColor: string; color: string; icon: React.ReactNode
}) {
  const palette: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: 'text-blue-300' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', icon: 'text-violet-300' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'text-amber-300' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: 'text-green-300' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'text-red-300' },
  }
  const p = palette[color] ?? palette.blue
  return (
    <div className={`rounded-xl border ${p.bg} ${p.border} p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${p.text}`}>{value}</span>
        <span className={p.icon}>{icon}</span>
      </div>
      <p className="text-xs font-semibold text-gray-600 truncate">{label}</p>
      <p className={`text-[11px] ${subColor} font-medium`}>{sub}</p>
    </div>
  )
}

function EmptyBox({ icon, title, subtitle, color }: {
  icon: React.ReactNode; title: string; subtitle: string; color: string
}) {
  const palette: Record<string, string> = {
    blue:   'from-blue-50/80 border-blue-100',
    violet: 'from-violet-50/80 border-violet-100',
    amber:  'from-amber-50/80 border-amber-100',
    green:  'from-green-50/80 border-green-100',
  }
  return (
    <div className={`bg-gradient-to-br ${palette[color] ?? palette.blue} to-white rounded-xl border p-8 text-center`}>
      <div className="flex justify-center mb-3 opacity-60">{icon}</div>
      <p className="font-semibold text-gray-700 text-sm">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}

function MetaRow({ icon, text, muted = false }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs truncate ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  )
}

function Pill({ color, label }: { color: 'red' | 'orange'; label: string }) {
  const cls = color === 'red'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-orange-100 text-orange-700 border-orange-200'
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-yellow-400', LOW: 'bg-blue-300',
  }
  return (
    <span title={priority} className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${cls[priority] ?? 'bg-gray-300'}`} />
  )
}