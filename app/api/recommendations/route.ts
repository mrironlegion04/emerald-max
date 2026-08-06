import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getAssetRecommendations } from '@/lib/recommendations'
import { canViewAsset } from '@/lib/access-control'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assetId = request.nextUrl.searchParams.get('assetId')
  if (!assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 })

  // Plant isolation: only recommend against assets the user can actually see.
  if (!(await canViewAsset(user, assetId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const recommendations = await getAssetRecommendations(assetId)
  return NextResponse.json(recommendations)
}
