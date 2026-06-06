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
      skills: {
        include: {
          skill: true,
        },
      },
    },
  })
  if (!target) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <a href="/users" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to users
        </a>
        <a href={`/users/${id}/view`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          View mode
        </a>
      </div>
      <PageHeader title={`Edit: ${target.name}`} subtitle={target.email} />
      <UserForm
        userId={id}
        initialData={{
          id,
          name: target.name,
          email: target.email,
          role: target.role,
          isActive: target.isActive,
          phone: target.phone ?? '',
          bio: target.bio ?? '',
          department: target.department ?? '',
          domainId: target.domainId ?? '',
          userSkills: target.skills,
          hasFaceVerification: target.hasFaceVerification,
          lastFaceVerifyAt: target.lastFaceVerifyAt,
          facePhotoUrl: target.facePhotoUrl ?? undefined,
        }}
      />
    </div>
  )
}
