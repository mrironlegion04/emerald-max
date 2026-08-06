import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-5xl font-black text-gray-200 mb-4">404</p>
        <h1 className="text-lg font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-600 mt-2">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/work-orders" className="mt-6 inline-block btn-primary text-sm">
          Go to work orders
        </Link>
      </div>
    </div>
  )
}
