import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { IssueService } from '@/lib/services/issue-service'
import { hasPermission } from '@/lib/permissions'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'issue:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const diagnostics = await IssueService.getDiagnostics()
    return NextResponse.json(diagnostics)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to get diagnostics' }, { status: 500 })
  }
}
