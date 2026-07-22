import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import UserDisplay from '@/components/UserDisplay'

export default async function ViewUserPage({
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
      <div className="mb-4">
        <a href="/users" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to users
        </a>
      </div>
      <PageHeader title={target.name} subtitle={`${target.role} • ${target.isActive ? 'Active' : 'Inactive'}`} />
      <UserDisplay
        user={{
          id,
          name: target.name,
          email: target.email,
          role: target.role,
          isActive: target.isActive,
          phone: target.phone ?? undefined,
          bio: target.bio ?? undefined,
          department: target.department ?? undefined,
          hasFaceVerification: target.hasFaceVerification,
          facePhotoUrl: target.facePhotoUrl ?? undefined,
          lastFaceVerifyAt: target.lastFaceVerifyAt,
          userSkills: target.skills,
        }}
        userId={id}
      />
    </div>
  )
}
