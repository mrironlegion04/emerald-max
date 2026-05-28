import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { Mail, Phone, Briefcase, Calendar } from 'lucide-react'

function fmt(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export default async function UserProfilePage() {
  const user = await getCurrentUser()
  if (!user) notFound()

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: {
      skills: {
        include: { skill: true },
      },
      _count: {
        select: {
          assignedWorkOrders: true,
          createdWorkOrders: true,
        },
      },
    },
  })

  if (!dbUser) notFound()

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    MANAGER: 'bg-blue-100 text-blue-800',
    TECHNICIAN: 'bg-green-100 text-green-800',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to dashboard
        </Link>
      </div>

      <PageHeader
        title="My Profile"
        subtitle="View your professional information and skills"
      />

      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-blue-600">
                {dbUser.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{dbUser.name}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${roleColors[dbUser.role] || 'bg-gray-100 text-gray-800'}`}>
                {dbUser.role}
              </span>
            </div>
          </div>
        </div>

        {/* Contact & Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">Email</p>
              <p className="text-sm font-medium text-gray-900 truncate">{dbUser.email}</p>
            </div>
          </div>

          {dbUser.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-gray-900">{dbUser.phone}</p>
              </div>
            </div>
          )}

          {dbUser.department && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Department</p>
                <p className="text-sm font-medium text-gray-900">{dbUser.department}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Joined</p>
              <p className="text-sm font-medium text-gray-900">{fmt(dbUser.createdAt)}</p>
            </div>
          </div>
        </div>

        {dbUser.bio && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-700">{dbUser.bio}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Assigned Work Orders</p>
          <p className="text-2xl font-bold text-blue-600">{dbUser._count.assignedWorkOrders}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Created Work Orders</p>
          <p className="text-2xl font-bold text-green-600">{dbUser._count.createdWorkOrders}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Skills</p>
          <p className="text-2xl font-bold text-purple-600">{dbUser.skills.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Performance Rating</p>
          <p className="text-2xl font-bold text-yellow-600">{dbUser.averageRating > 0 ? dbUser.averageRating.toFixed(1) : '—'}</p>
        </div>
      </div>

      {/* Skills & Competencies */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Skills & Competencies</h2>
        {dbUser.skills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dbUser.skills.map((us: any) => (
              <div key={us.id} className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-blue-900">{us.skill.name}</p>
                    {us.skill.category && <p className="text-xs text-blue-600 mt-1">{us.skill.category}</p>}
                  </div>
                  <div className="ml-2 whitespace-nowrap">
                    <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                      {us.proficiencyLevel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No skills assigned yet. Contact your manager to add skills.</p>
        )}
      </div>
    </div>
  )
}
