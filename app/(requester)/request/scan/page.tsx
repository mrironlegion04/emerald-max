import QRScanner from '@/components/QRScanner'

export const metadata = {
  title: 'Scan to Request | CMMS',
  description: 'Scan an asset QR code to report an issue',
}

export default function RequestScanPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scan to Request</h1>
        <p className="text-gray-600">
          Scan the QR code on an asset to start a pre-filled maintenance request for it.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <QRScanner requestMode />
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-3">How it works</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Point your camera at the asset QR label</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>The request form opens with the asset already selected</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Describe the issue and submit</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
