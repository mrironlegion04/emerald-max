'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface QRScannerProps {
  onScanSuccess?: (result: string) => void
  onScanError?: (error: string) => void
}

export default function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const router = useRouter()
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending')
  const [isScanning, setIsScanning] = useState(true)
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scannerInstanceRef = useRef<any>(null)

  // Load html5-qrcode from CDN
  useEffect(() => {
    const loadQRScanner = async () => {
      try {
        // Check if html5-qrcode is already loaded
        if (!(window as any).Html5Qrcode) {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.4/html5-qrcode.min.js'
          script.async = true
          script.onload = () => {
            initializeScanner()
          }
          script.onerror = () => {
            setError('Failed to load QR code scanner library')
            setCameraPermission('denied')
            onScanError?.('Failed to load QR code library')
          }
          document.head.appendChild(script)
        } else {
          initializeScanner()
        }
      } catch (err) {
        setError('Failed to initialize scanner')
        setCameraPermission('denied')
        onScanError?.('Failed to initialize scanner')
      }
    }

    loadQRScanner()

    return () => {
      // Cleanup
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(() => {})
      }
    }
  }, [onScanError])

  const initializeScanner = async () => {
    try {
      const Html5Qrcode = (window as any).Html5Qrcode

      // Request camera permission
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        setCameraPermission('granted')
      } catch (err) {
        setCameraPermission('denied')
        setError('Camera permission denied. Please allow camera access in browser settings.')
        onScanError?.('Camera permission denied')
        return
      }

      // Create scanner instance
      const scanner = new Html5Qrcode('qr-reader')
      scannerInstanceRef.current = scanner

      // Handle successful scan
      const onScanSuccess = (decodedText: string) => {
        setScanned(true)
        setIsScanning(false)

        // Parse the scanned URL
        try {
          const url = new URL(decodedText)
          const pathname = url.pathname
          const assetMatch = pathname.match(/\/assets\/([a-z0-9-]+)/i)
          const partMatch = pathname.match(/\/parts\/([a-z0-9-]+)/i)

          if (assetMatch) {
            router.push(`/assets/${assetMatch[1]}`)
          } else if (partMatch) {
            router.push(`/parts/${partMatch[1]}`)
          } else {
            setError('Invalid QR code. Expected asset or part link.')
            setScanned(false)
            setIsScanning(true)
            scanner.resume()
          }
        } catch (err) {
          setError('Failed to parse QR code URL')
          setScanned(false)
          setIsScanning(true)
          scanner.resume()
        }
      }

      // Start scanner
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        undefined // error callback (suppress errors while scanning)
      )

      setIsScanning(true)
    } catch (err: any) {
      setError(err.message || 'Failed to start scanner')
      setCameraPermission('denied')
      onScanError?.(err.message)
    }
  }

  const handleRetry = () => {
    setScanned(false)
    setError('')
    setIsScanning(true)
    if (scannerInstanceRef.current) {
      scannerInstanceRef.current.resume().catch(() => {})
    }
  }

  if (cameraPermission === 'denied') {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">📷</div>
          <h3 className="font-semibold text-red-900 mb-2">Camera Access Denied</h3>
          <p className="text-sm text-red-700 mb-4">
            Please enable camera access in your browser settings to scan QR codes.
          </p>
          <div className="space-y-2 text-xs text-red-600">
            <p className="font-medium">Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click the camera icon in your address bar</li>
              <li>Select "Allow" for camera access</li>
              <li>Reload this page</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Scanner Container */}
      <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '1' }}>
        <div id="qr-reader" style={{ width: '100%', height: '100%' }} />

        {/* Status Overlay */}
        {scanned && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-2">✓</div>
              <p className="text-white font-semibold">QR Code Scanned!</p>
              <p className="text-gray-300 text-sm">Redirecting...</p>
            </div>
          </div>
        )}

        {!isScanning && !scanned && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-white font-semibold">Scanner paused</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <span className="text-red-600 text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!error && isScanning && !scanned && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">📸 Point your camera</span> at an asset or part QR code to scan.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {scanned ? (
          <button
            onClick={handleRetry}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Scan Another
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsScanning(!isScanning)}
              className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors ${
                isScanning
                  ? 'bg-red-100 hover:bg-red-200 text-red-700'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
              }`}
            >
              {isScanning ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>

      {/* Camera Info */}
      <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs text-gray-600 space-y-1">
        <p>💡 <span className="font-medium">Tips:</span></p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Make sure there is good lighting</li>
          <li>Hold the camera steady 15-25cm away</li>
          <li>Center the QR code in the frame</li>
        </ul>
      </div>

      {/* Canvas (hidden, used for processing) */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
