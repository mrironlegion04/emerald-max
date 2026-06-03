import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import PartForm from '@/components/PartForm'

export default async function EditPartPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user   = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect(`/inventory/${id}`)

  const part = await prisma.part.findUnique({ where: { id } })
  if (!part) notFound()
  if (part.isDeleted) redirect(`/inventory/${id}`)

  const initialData = {
    name:        part.name,
    partNumber:  part.partNumber,
    description: part.description ?? '',
    unitCost:    part.unitCost != null ? String(part.unitCost) : '',
    unit:        part.unit,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/inventory/${id}`} className="text-sm text-gray-400 hover:text-gray-600">← Back to part</Link>
      </div>
      <PageHeader title={`Edit: ${part.name}`} subtitle={part.partNumber} />
      <PartForm initialData={initialData} partId={id} />
    </div>
  )
}
