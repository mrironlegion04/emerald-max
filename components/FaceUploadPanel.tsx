'use client'

import { useRef, useState } from 'react'
import { Upload, Camera, X, Check } from 'lucide-react'

interface FaceUploadPanelProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  userId?: string
}

export default function FaceUploadPanel({
  onSuccess,
  onError,
}: FaceUploadPanelProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [useCamera, setUseCamera] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      const msg = 'Please select a valid image file'
      setError(msg)
      onError?.(msg)
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = e => setPreviewUrl(e.target?.result as string)
    reader.readAsDataURL(file)

    await uploadFace(file)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      const msg = 'Could not access camera. Please check permissions.'
      setError(msg)
      onError?.(msg)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      setCameraActive(false)
    }
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const context = canvasRef.current.getContext('2d')
    if (!context) return

    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
    
    canvasRef.current.toBlob(async blob => {
      if (!blob) return
      
      const file = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' })
      setPreviewUrl(canvasRef.current!.toDataURL('image/jpeg'))
      stopCamera()
      setUseCamera(false)
      
      await uploadFace(file)
    }, 'image/jpeg', 0.95)
  }

  const uploadFace = async (file: File) => {
    try {
      setLoading(true)
      setError(null)

      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/face/register', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register face')
      }

      const data = await response.json()
      setSuccess(true)
      setPreviewUrl(null)
      
      // Reset form after success
      setTimeout(() => {
        setSuccess(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        onSuccess?.()
      }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register face'
      setError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Face Verification Setup</h2>

      {/* Status messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">Face registered successfully!</p>
        </div>
      )}

      {/* Preview */}
      {previewUrl && !cameraActive && (
        <div className="mb-4">
          <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
        </div>
      )}

      {/* Camera View */}
      {cameraActive && (
        <div className="mb-4 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 object-cover rounded-lg bg-black"
          />
          <canvas ref={canvasRef} width={640} height={480} className="hidden" />
          <div className="absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-none">
            <div className="absolute inset-8 border-2 border-dashed border-blue-300" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        {!cameraActive ? (
          <>
            {/* File upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Click to upload a photo</p>
              <p className="text-xs text-gray-500">or drag and drop</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </div>

            {/* Camera button */}
            <button
              onClick={startCamera}
              disabled={loading}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Take a photo
            </button>
          </>
        ) : (
          <>
            {/* Camera controls */}
            <button
              onClick={capturePhoto}
              disabled={loading}
              className="w-full btn-primary"
            >
              Capture Photo
            </button>
            <button
              onClick={stopCamera}
              disabled={loading}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        💡 Make sure your face is clearly visible with good lighting
      </p>
    </div>
  )
}
