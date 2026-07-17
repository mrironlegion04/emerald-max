import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, CheckCircle, XCircle, FileText } from 'lucide-react'

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock, label: 'Pending' },
  APPROVED: { bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckCircle, label: 'Approved' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, label: 'Rejected' },
  CONVERTED: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle, label: 'Converted to WO' },
  CANCELLED: { bg: 'bg-slate-50', text: 'text-slate-500', icon: XCircle, label: 'Cancelled' },
}

export default async function MyRequestsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      OR: [
        { requesterId: user.userId },
        { requesterName: user.name },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Requests</h1>
            <p className="text-sm text-slate-500">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/request" className="btn-primary text-sm">
          New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No requests yet</p>
          <p className="text-sm text-slate-400 mt-1">Submit your first maintenance request</p>
          <Link href="/request" className="mt-4 btn-primary text-sm inline-block">
            Submit Request
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const statusKey = req.status ?? 'PENDING'
            const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.PENDING
            const StatusIcon = status.icon

            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">{req.title}</h3>
                    {req.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{req.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                      {req.location && <span>{req.location}</span>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} shrink-0`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                  <span>Submitted {new Date(req.createdAt).toLocaleDateString()}</span>
                  {req.priority && (
                    <span className={`font-medium ${
                      req.priority === 'CRITICAL' ? 'text-red-600' :
                      req.priority === 'HIGH' ? 'text-orange-500' :
                      req.priority === 'MEDIUM' ? 'text-blue-600' :
                      'text-slate-400'
                    }`}>
                      {req.priority}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
