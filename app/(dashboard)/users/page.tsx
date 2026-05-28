import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { Trash2 } from 'lucide-react'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 10

function fmt(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

const roleVariant = (role: string) =>
  role === 'ADMIN' ? 'purple' : role === 'MANAGER' ? 'blue' : 'green' as const

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            assignedWorkOrders: true,
            createdWorkOrders: true,
            skills: true,
          },
        },
      },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.user.count(),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/users'

  const getStatusBadge = (user: any) => {
    if (!user.isActive) return <Badge label="Inactive" variant="gray" />
    if (user.lastActiveAt && new Date(user.lastActiveAt).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      return <Badge label="Inactive (7+ days)" variant="yellow" />
    }
    return <Badge label="Active" variant="green" />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Users Management"
        subtitle={`${totalCount} total · ${users.length} showing`}
        action={
          <div className="flex gap-2">
            <Link href="/settings/skills" className="btn-secondary text-sm">
              Skills Catalog
            </Link>
            <Link href="/users/new" className="btn-primary text-sm">
              + Add user
            </Link>
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
        {/* Mobile/Tablet Card View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {users.map((u: any) => {
            const initial = u.name
              ? u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              : 'U'
            return (
              <div key={u.id} className="p-4.5 space-y-3 hover:bg-slate-50/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-3xs">
                    <span className="text-blue-700 font-bold text-xs">
                      {initial}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/users/${u.id}/view`} className="font-bold text-slate-900 text-sm hover:text-blue-600 truncate block">
                      {u.name}
                    </Link>
                    <p className="text-xs text-slate-500 font-medium truncate">{u.email}</p>
                    {u.phone && <p className="text-xs text-slate-400 font-mono mt-0.5">{u.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge label={u.role} variant={roleVariant(u.role)} />
                    {getStatusBadge(u)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1 border-t border-b border-dashed border-slate-100">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Department</span>
                    <span className="text-slate-700 font-bold">{u.department || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Skills</span>
                    <span className="text-slate-700 font-bold">
                      {u._count.skills > 0 ? `${u._count.skills} skill${u._count.skills !== 1 ? 's' : ''}` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-400 font-medium">
                    WO Tasks: <span className="font-bold text-slate-700">{u._count.assignedWorkOrders} assigned</span>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/users/${u.id}/view`}
                      className="text-xs text-slate-500 hover:text-blue-600 font-bold active:scale-95 transition-all"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={`/users/${u.id}/edit`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold active:scale-95 transition-all"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-150 bg-slate-50/50">
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Department
                </th>
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Skills
                </th>
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Work Orders (Assigned/Created)
                </th>
                <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-3xs">
                        <span className="text-blue-700 font-bold text-xs">
                          {u.name
                            ? u.name
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : 'U'}
                        </span>
                      </div>
                      <div>
                        <Link href={`/users/${u.id}/view`} className="font-bold text-slate-900 hover:text-blue-600 block leading-snug">
                          {u.name}
                        </Link>
                        <p className="text-xs text-slate-400 font-medium">{u.email}</p>
                        {u.phone && <p className="text-xs text-slate-400 font-mono mt-0.5">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge label={u.role} variant={roleVariant(u.role)} />
                  </td>
                  <td className="px-5 py-4">{getStatusBadge(u)}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">
                    {u.department ? (
                      <span className="text-sm font-semibold">{u.department}</span>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {u._count.skills > 0 ? (
                      <Badge label={`${u._count.skills} skill${u._count.skills !== 1 ? 's' : ''}`} variant="blue" />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600 font-semibold">
                    <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100 font-mono text-xs" title={`Assigned: ${u._count.assignedWorkOrders}, Created: ${u._count.createdWorkOrders}`}>
                      {u._count.assignedWorkOrders} / {u._count.createdWorkOrders}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs font-semibold">{fmt(u.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/users/${u.id}/view`}
                        className="text-xs text-slate-500 hover:text-blue-600 font-bold"
                      >
                        View
                      </Link>
                      <Link
                        href={`/users/${u.id}/edit`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="px-4 py-16 text-center border-t border-slate-100">
            <p className="text-slate-400 font-medium text-sm">No users found match your filter. Create a new user to build your team.</p>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/20">
            <div className="text-xs text-slate-500 font-medium">
              Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
            </div>
            <div className="flex gap-1.5">
              {page > 1 && (
                <Link href={baseUrl + '?page=1'} className="btn-secondary !text-xs py-1.5 px-3">
                  ← First
                </Link>
              )}
              {page > 1 && (
                <Link href={baseUrl + `?page=${page - 1}`} className="btn-secondary !text-xs py-1.5 px-3">
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={baseUrl + `?page=${page + 1}`} className="btn-secondary !text-xs py-1.5 px-3">
                  Next →
                </Link>
              )}
              {page < totalPages && (
                <Link href={baseUrl + `?page=${totalPages}`} className="btn-secondary !text-xs py-1.5 px-3">
                  Last →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Admins</p>
          <p className="text-2xl font-bold text-purple-600">{users.filter((u: any) => u.role === 'ADMIN').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-green-600">{users.filter((u: any) => u.isActive).length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Technicians</p>
          <p className="text-2xl font-bold text-blue-600">{users.filter((u: any) => u.role === 'TECHNICIAN').length}</p>
        </div>
      </div>
    </div>
  )
}
