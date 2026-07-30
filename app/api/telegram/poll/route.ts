import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { pollPairing } from '@/lib/telegram'

let lastUpdateId = 0
let isPolling = false

export async function POST() {
  if (isPolling) {
    return NextResponse.json({ linked: false, busy: true })
  }

  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    isPolling = true
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : undefined
    const result = await pollPairing(user.userId, offset)

    if (result.maxUpdateId && result.maxUpdateId > lastUpdateId) {
      lastUpdateId = result.maxUpdateId
    }

    if (result.linked) {
      lastUpdateId = 0
      return NextResponse.json({ linked: true })
    }

    return NextResponse.json({ linked: false })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 })
  } finally {
    isPolling = false
  }
}
