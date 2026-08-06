'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-600 mt-2">
              A critical error occurred. Please reload the page.
            </p>
            <button
              onClick={reset}
              className="mt-6 btn-primary text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
