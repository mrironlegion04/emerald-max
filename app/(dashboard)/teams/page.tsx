'use client'

import React, { Suspense } from 'react'
import TeamsAndUsersManager from '@/components/TeamsAndUsersManager'

export default function TeamsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto animate-spin-slow" />
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading Teams & Users Management...</p>
        </div>
      </div>
    }>
      <TeamsAndUsersManager />
    </Suspense>
  )
}
