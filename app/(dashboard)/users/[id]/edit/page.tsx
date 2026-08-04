import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import UserForm from '@/components/UserForm'

export default async function EditUserPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      userLocations: {
        select: { locationId: true },
      },
      teamScopes: {
        select: {
          teamId: true,
          canCloseWO: true,
          canAssignWO: true,
          canEditWO: true,
          canApproveRequest: true,
          canConvertRequest: true,
          canManagePM: true,
          canManageAssets: true,
        },
      },
      skills: {
        include: {
          skill: true,
        },
      },
    },
  })
  if (!target) notFound()

  const teams = await prisma.team.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, trade: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <a href="/teams?tab=users" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to users
        </a>
        <a href={`/users/${id}/view`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          View mode
        </a>
      </div>
      <PageHeader title={`Edit: ${target.name}`} subtitle={target.email} />
      <UserForm
        userId={id}
        teams={teams}
        initialData={{
          id,
          name: target.name,
          email: target.email,
          username: target.username ?? '',
          role: target.role,
          isActive: target.isActive,
          phone: target.phone ?? '',
          bio: target.bio ?? '',
          department: target.department ?? '',
          woVisibility: target.woVisibility,
          customRoleId: target.customRoleId ?? '',
          assignedLocationIds: target.userLocations.map(ul => ul.locationId),
          assignedTeamIds: target.teamScopes.map(ts => ts.teamId),
          teamScope: target.teamScopes.length > 0 ? {
            canCloseWO: target.teamScopes[0].canCloseWO,
            canAssignWO: target.teamScopes[0].canAssignWO,
            canEditWO: target.teamScopes[0].canEditWO,
            canApproveRequest: target.teamScopes[0].canApproveRequest,
            canConvertRequest: target.teamScopes[0].canConvertRequest,
            canManagePM: target.teamScopes[0].canManagePM,
            canManageAssets: target.teamScopes[0].canManageAssets,
          } : undefined,
          userSkills: target.skills,
          hasFaceVerification: target.hasFaceVerification,
          lastFaceVerifyAt: target.lastFaceVerifyAt,
          facePhotoUrl: target.facePhotoUrl ?? undefined,
        }}
      />
    </div>
  )
}
