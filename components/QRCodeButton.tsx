'use client'

import { useState } from 'react'
import { QrCode } from 'lucide-react'

interface Props { assetId: string; assetCode: string | null; assetName: string }

export default function QRCodeButton({ assetId, assetCode, assetName }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [svgContent,  setSvgContent]  = useState('')

  async function loadPreview() {
    if (svgContent) { setShowPreview(true); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/assets/${assetId}/qr?format=svg`)
      const text = await res.text()
      setSvgContent(text)
      setShowPreview(true)
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  function downloadSVG() {
    if (!svgContent || !assetCode) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `qr-${assetCode}.svg`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadPNG() {
    if (!assetCode) return
    const a = document.createElement('a')
    a.href     = `/api/assets/${assetId}/qr?format=png`
    a.download = `qr-${assetCode}.png`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
  }

  function printQR() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head><title>QR — ${assetName}</title>
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
        disabled={loading || !assetCode}
        className="btn-secondary text-sm flex items-center gap-1.5"
      >
        <QrCode className="w-4 h-4" />
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
            Scan to open asset detail page
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button onClick={downloadSVG} className="btn-secondary text-xs py-1.5">Download SVG</button>
            <button onClick={downloadPNG} className="btn-secondary text-xs py-1.5">Download PNG</button>
            <button onClick={printQR}     className="btn-secondary text-xs py-1.5">Print</button>
            <button onClick={() => setShowPreview(false)} className="text-xs text-gray-400 hover:text-gray-600 py-1.5 px-2">Hide</button>
          </div>
        </div>
      )}
    </div>
  )
}