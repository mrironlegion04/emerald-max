import Link from 'next/link'
import { prisma } from '@/lib/db'
import Badge, { assetStatusVariant } from '@/components/Badge'

interface Props {
  assetId: string
  parentId: string | null
}

export default async function AssetHierarchyPanel({ assetId, parentId }: Props) {
  const [parent, children] = await Promise.all([
    parentId ? prisma.asset.findUnique({ where: { id: parentId }, select: { id: true, name: true, assetCode: true, status: true } }) : null,
    prisma.asset.findMany({ where: { isDeleted: false, parentId: assetId }, select: { id: true, name: true, assetCode: true, status: true }, orderBy: { name: 'asc' } }),
  ])

  if (!parent && children.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-2">Asset hierarchy</h2>
        <p className="text-sm text-gray-400">No parent or child assets linked.</p>
        <p className="text-xs text-gray-400 mt-1">Edit the asset to set a parent asset.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 text-sm mb-4">Asset hierarchy</h2>

      {parent && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parent asset</p>
          <Link href={`/assets/${parent.id}`}
            className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div>
              <p className="text-sm font-medium text-blue-600">{parent.name}</p>
              <p className="text-xs text-gray-400 font-mono">{parent.assetCode}</p>
            </div>
            <Badge label={parent.status} variant={assetStatusVariant(parent.status)} />
          </Link>
        </div>
      )}

      {children.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Child assets ({children.length})
          </p>
          <div className="space-y-1.5">
            {children.map(child => (
              <Link key={child.id} href={`/assets/${child.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div>
                  <p className="text-sm font-medium text-blue-600">{child.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{child.assetCode}</p>
                </div>
                <Badge label={child.status} variant={assetStatusVariant(child.status)} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}