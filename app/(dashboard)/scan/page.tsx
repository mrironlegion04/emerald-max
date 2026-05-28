import QRScanner from '@/components/QRScanner'

export const metadata = {
  title: 'QR Code Scanner | CMMS',
  description: 'Scan asset or part QR codes',
}

export default function ScanPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">QR Code Scanner</h1>
        <p className="text-gray-600">
          Scan asset or part QR codes with your mobile device to quickly access them
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <QRScanner />
      </div>

      {/* Info Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">📦 Assets</h3>
          <p className="text-sm text-gray-600">
            Scan an asset QR code to jump directly to its detail page, view maintenance history, and log readings.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">🔧 Parts</h3>
          <p className="text-sm text-gray-600">
            Scan a part QR code to access inventory details, pricing, and stock information.
          </p>
        </div>
      </div>

      {/* Best Practices */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Best Practices</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Use your device's rear camera for better focus</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Ensure adequate lighting on the QR code</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Keep a steady distance (15-25cm)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Print QR codes at least 2cm x 2cm</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
