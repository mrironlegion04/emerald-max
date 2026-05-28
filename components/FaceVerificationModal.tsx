'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Camera, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react'

interface FaceVerificationModalProps {
  userId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: (verified: boolean) => void
  requiredSimilarity?: number
}

export default function FaceVerificationModal({
  userId,
  isOpen,
  onClose,
  onSuccess,
  requiredSimilarity = 60,
}: FaceVerificationModalProps) {
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showingSuccess, setShowingSuccess] = useState(false)

  const [result, setResult] = useState<{
    verified: boolean
    similarity: number
  } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  if (!isOpen) return null

  // Start camera on mount
  useEffect(() => {
    if (isOpen) {
      startCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen])

  const startCamera = async () => {
    try {
      setCameraError(null)
      setError(null)
      setCameraStarted(false)

      console.log('Requesting camera...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      console.log('Camera granted, setting stream...')
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraStarted(true)
        console.log('Camera started')
      }
    } catch (err) {
      console.error('Camera error:', err)
      const msg = err instanceof Error ? err.message : 'Unable to access camera'
      setCameraError(msg)
      setCameraStarted(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraStarted(false)
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    try {
      const canvas = canvasRef.current
      const video = videoRef.current

      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(video, 0, 0)
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], 'face.jpg', { type: 'image/jpeg' })
          stopCamera()
          verifyFace(file)
        }
      }, 'image/jpeg', 0.95)
    } catch (err) {
      setError('Failed to capture photo')
      console.error(err)
    }
  }

  const verifyFace = async (file: File) => {
    try {
      setVerifying(true)
      setError(null)

      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('image', file)

      const res = await fetch('/api/face/verify', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Verification failed')
      }

      const data = await res.json()
      const verified = data.verified && data.similarity >= requiredSimilarity

      setResult({
        verified,
        similarity: data.similarity,
      })

      if (verified) {
        // Show success for 1 second, then show Continue button
        setShowingSuccess(true)
        setTimeout(() => {
          setShowingSuccess(false)
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setResult({
        verified: false,
        similarity: 0,
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleContinueAfterSuccess = () => {
    onSuccess?.(true)
    onClose()
  }

  const handleRetry = async () => {
    setResult(null)
    setError(null)
    startCamera()
  }

  const handleClose = () => {
    stopCamera()
    setResult(null)
    setError(null)
    setCameraError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Verify Your Identity</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Verification Result */}
          {result && (
            <div
              className={`p-4 rounded-xl flex gap-3 ${
                result.verified
                  ? 'bg-green-100 border border-green-300'
                  : 'bg-red-100 border border-red-300'
              }`}
            >
              {result.verified ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              )}
              <div>
                <p className={`font-bold ${result.verified ? 'text-green-800' : 'text-red-800'}`}>
                  {result.verified ? 'Identity Verified ✓' : 'Verification Failed'}
                </p>
                <p className={`text-sm mt-1 ${result.verified ? 'text-green-700' : 'text-red-700'}`}>
                  Match: {result.similarity.toFixed(1)}% (Required: {requiredSimilarity}%)
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !result && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Camera Error */}
          {cameraError && !cameraStarted && (
            <div className="p-4 bg-orange-100 border border-orange-300 rounded-lg">
              <p className="text-sm font-medium text-orange-800">Camera Access Required</p>
              <p className="text-xs text-orange-700 mt-1">{cameraError}</p>
            </div>
          )}

          {/* Video Container (Always rendered, shown when cameraStarted) */}
          <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '1/1', display: cameraStarted && !result ? 'block' : 'none' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transform: 'scaleX(-1)',
                backgroundColor: '#000',
              }}
            />
            {/* Face Guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-52 border-4 border-blue-400 rounded-3xl opacity-60" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Loading State */}
          {!cameraStarted && !result && !cameraError && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin mb-4">
                <Camera className="w-12 h-12 text-blue-500" />
              </div>
              <p className="text-gray-700 font-medium">Starting camera...</p>
              <p className="text-xs text-gray-500 mt-1">Please grant camera permission</p>
            </div>
          )}

          {/* Instructions */}
          {cameraStarted && !result && (
            <div className="p-3 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                📷 Position your face and tap Capture
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {cameraStarted && !result && !verifying && (
              <button
                onClick={capturePhoto}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture Photo
              </button>
            )}

            {result && !result.verified && (
              <button
                onClick={handleRetry}
                disabled={verifying}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
            )}

            {verifying && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin">
                  <div className="w-6 h-6 border-3 border-blue-300 border-t-blue-600 rounded-full" />
                </div>
                <p className="ml-3 text-sm text-gray-600">Verifying...</p>
              </div>
            )}

            {result && result.verified && showingSuccess && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin mr-3">
                  <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full" />
                </div>
                <p className="text-sm text-gray-600">Proceeding...</p>
              </div>
            )}

            {result && result.verified && !showingSuccess && (
              <button
                onClick={handleContinueAfterSuccess}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                Continue to Completion
              </button>
            )}

            {!result && (
              <button
                onClick={handleClose}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-900 py-2"
              >
                Skip Verification
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
