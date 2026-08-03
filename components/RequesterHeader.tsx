import Link from 'next/link'
import { Settings, ClipboardList, Plus } from 'lucide-react'

export default function RequesterHeader() {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/85 px-4 sm:px-8 py-3.5 flex items-center justify-between flex-shrink-0 sticky top-0 z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
      <div className="flex items-center gap-2.5">
        <div className="w-7.5 h-7.5 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-600/30">
          <Settings className="w-4 h-4 text-white animate-spin-slow" />
        </div>
        <span className="font-extrabold text-slate-900 text-sm tracking-wider font-sans leading-none">EMERALD MAINTENANCE</span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/my-requests" className="btn-secondary text-xs flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4" /> My Requests
        </Link>
        <Link href="/request" className="btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Request
        </Link>
      </div>
    </header>
  )
}
