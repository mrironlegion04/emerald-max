'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
        <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-600 mt-2">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 btn-primary text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
