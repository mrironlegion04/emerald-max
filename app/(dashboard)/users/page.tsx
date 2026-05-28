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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                User
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Role
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Department
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Skills
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Work Orders
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Joined
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-semibold text-xs">
                        {u.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <Link href={`/users/${u.id}/view`} className="font-medium text-gray-900 hover:text-blue-600">
                        {u.name}
                      </Link>
                      <p className="text-xs text-gray-400">{u.email}</p>
                      {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge label={u.role} variant={roleVariant(u.role)} />
                </td>
                <td className="px-4 py-3">{getStatusBadge(u)}</td>
                <td className="px-4 py-3">
                  {u.department ? (
                    <span className="text-sm text-gray-700">{u.department}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u._count.skills > 0 ? (
                    <Badge label={`${u._count.skills} skill${u._count.skills !== 1 ? 's' : ''}`} variant="blue" />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <span title={`Assigned: ${u._count.assignedWorkOrders}, Created: ${u._count.createdWorkOrders}`}>
                    {u._count.assignedWorkOrders}/{u._count.createdWorkOrders}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/users/${u.id}/view`}
                      className="text-xs text-gray-600 hover:text-blue-600 font-medium"
                    >
                      View
                    </Link>
                    <Link
                      href={`/users/${u.id}/edit`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-gray-500">No users yet. Create one to get started.</p>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-5 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={baseUrl + '?page=1'} className="btn-secondary text-sm">
                  ← First
                </Link>
              )}
              {page > 1 && (
                <Link href={baseUrl + `?page=${page - 1}`} className="btn-secondary text-sm">
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={baseUrl + `?page=${page + 1}`} className="btn-secondary text-sm">
                  Next →
                </Link>
              )}
              {page < totalPages && (
                <Link href={baseUrl + `?page=${totalPages}`} className="btn-secondary text-sm">
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
          <p className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'ADMIN').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-green-600">{users.filter(u => u.isActive).length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Technicians</p>
          <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'TECHNICIAN').length}</p>
        </div>
      </div>
    </div>
  )
}
