'use client'

import { useState } from 'react'
import { QrCode, X, Download, Printer, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

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
    if (showPreview) {
      setShowPreview(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/${partId}/qr?raw=true`)
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

  async function printQR() {
    // For printing, we fetch the formatted card SVG instead of raw
    const res = await fetch(`/api/inventory/${partId}/qr`)
    const fullCardSvg = await res.text()

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head><title>QR — ${partName}</title>
<style>
  body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
  .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; text-align: center; max-width: 350px; }
  svg { width: 100%; height: auto; max-width: 280px; }
  .info { margin-top: 24px; }
  .name { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2; }
  .code { font-size: 14px; font-weight: 600; color: #64748b; font-family: monospace; margin-top: 6px; letter-spacing: 0.05em; text-transform: uppercase; }
  @media print {
    body { background: white; }
    .card { border: none; box-shadow: none; padding: 0; }
  }
</style></head>
<body>
  <div class="card">
    ${fullCardSvg.replace(/<\?xml[^>]*\?>/, '')}
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
        window.close();
      }, 500);
    };
  </script>
</body></html>`)
    win.document.close()
  }

  return (
    <>
      <button
        onClick={loadPreview}
        disabled={loading}
        className="btn-secondary text-sm flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors shadow-sm"
      >
        <QrCode className="w-4 h-4 text-slate-500" />
        {loading ? 'Generating...' : 'Part QR'}
      </button>

      <AnimatePresence>
        {showPreview && svgContent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreview(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">QR Inventory Label</h3>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* QR Container */}
              <div className="p-8 pb-4">
                <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 shadow-inner flex flex-col items-center">
                  <div
                    className="w-full max-w-[200px]"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />
                  <div className="mt-6 text-center">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{partName}</p>
                    <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-wider">{partNumber}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 pt-2">
                <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-[0.2em] mb-4">
                  Export & Print Management
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={downloadPNG}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    PNG Image
                  </button>
                  <button 
                    onClick={printQR}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                  >
                    <Printer className="w-4 h-4" />
                    Print Label
                  </button>
                </div>
                <button 
                  onClick={downloadSVG}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Download Vector (SVG)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
