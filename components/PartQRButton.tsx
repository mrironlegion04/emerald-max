'use client'

import { useState } from 'react'

interface Props {
  partId: string
  partNumber: string
  partName: string
}

export default function PartQRButton({ partId, partNumber, partName }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [svgContent, setSvgContent] = useState('')

  async function loadPreview() {
    if (svgContent) {
      setShowPreview(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/${partId}/qr?format=svg`)
      const text = await res.text()
      setSvgContent(text)
      setShowPreview(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function downloadSVG() {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${partNumber}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadPNG() {
    const a = document.createElement('a')
    a.href = `/api/inventory/${partId}/qr?format=png`
    a.download = `qr-${partNumber}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function printQR() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head><title>QR — ${partName}</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
svg{max-width:300px}</style></head>
<body>${svgContent}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div>
      <button
        onClick={loadPreview}
        disabled={loading}
        className="btn-secondary text-sm flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        {loading ? 'Generating...' : 'QR code'}
      </button>

      {showPreview && svgContent && (
        <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div
            className="flex justify-center mb-3"
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{ maxWidth: 220, margin: '0 auto 12px' }}
          />
          <p className="text-xs text-gray-500 text-center mb-3">
            Scan to open part detail page
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={downloadSVG}
              className="btn-secondary text-xs py-1.5 px-2"
            >
              Download SVG
            </button>
            <button
              onClick={downloadPNG}
              className="btn-secondary text-xs py-1.5 px-2"
            >
              Download PNG
            </button>
            <button
              onClick={printQR}
              className="btn-secondary text-xs py-1.5 px-2"
            >
              Print
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
