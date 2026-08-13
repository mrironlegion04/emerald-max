import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import RequesterRequestEditForm from '@/components/RequesterRequestEditForm'
import { utcDateOnly } from '@/lib/date-format'

export default async function MyWorkOrderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const wo = await prisma.workOrder.findFirst({
    where: { id, requestedById: user.userId },
    include: {
      issue: { select: { id: true, code: true, title: true } },
      asset: { select: { id: true, name: true, location: { select: { name: true, path: true } } } },
    },
  })

  if (!wo) redirect('/my-work-orders')

  // A requester can only edit their request while it is still open.
  if (wo.status !== 'OPEN') redirect(`/my-work-orders/${wo.id}`)

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link href={`/my-work-orders/${wo.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to request
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Edit request</h1>
        <p className="text-sm text-slate-500 mt-1">Update the details of your request. Changes are visible to the maintenance team immediately.</p>
      </div>

      <RequesterRequestEditForm
        woId={wo.id}
        initial={{
          title: wo.title,
          description: wo.description,
          priority: wo.priority,
          dueDate: wo.dueDate ? utcDateOnly(wo.dueDate) : null,
          teamId: wo.teamId,
          assetId: wo.assetId,
          assetName: wo.asset?.name ?? null,
          assetLocation: wo.asset?.location?.path ?? wo.asset?.location?.name ?? null,
          issueId: wo.issueId,
          issueTitle: wo.issue?.title ?? null,
          issueCode: wo.issue?.code ?? null,
          customIssue: wo.customIssue,
        }}
      />
    </div>
  )
}
