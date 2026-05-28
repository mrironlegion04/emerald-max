import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MeterDetailView from '@/components/MeterDetailView'

export default async function MeterDetailPage({
  params,
}: {
  params: Promise<{ id: string; meterId: string }>
}) {
  const { id, meterId } = await params
  const user = await getCurrentUser()
  if (!user) return notFound()

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, name: true, assetCode: true, isDeleted: true },
  })
  if (!asset || asset.isDeleted) return notFound()

  const meter = await prisma.meter.findFirst({
    where: { id: meterId, assetId: id, deletedAt: null },
    include: {
      _count: { select: { readings: true } },
    },
  })
  if (!meter) return notFound()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link
          href={`/assets/${id}?tab=meters`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back to {asset.name}
        </Link>
      </div>

      <MeterDetailView
        assetId={id}
        assetName={asset.name}
        meter={JSON.parse(JSON.stringify(meter))}
      />
    </div>
  )
}
