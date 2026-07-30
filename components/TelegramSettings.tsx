'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Link, Unlink, CheckCircle, RefreshCw } from 'lucide-react'

interface Props {
  telegramChatId: string | null
}

export default function TelegramSettings({ telegramChatId }: Props) {
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [deepLink, setDeepLink] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [])

  async function handleLink() {
    setLoading(true)
    setError('')
    setSent(false)
    setCode('')
    setMessage('')
    try {
      const res = await fetch('/api/telegram/pair', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setCode(data.code)
      setDeepLink(data.deepLink)
      setSent(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlink() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/telegram/pair', { method: 'DELETE' })
      if (!res.ok) { setError('Failed to unlink'); return }
      setSent(false)
      setCode('')
      setMessage('')
      window.location.reload()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function doPoll() {
    try {
      const res = await fetch('/api/telegram/poll', { method: 'POST' })
      const data = await res.json()
      if (data.linked) {
        if (pollTimer.current) clearInterval(pollTimer.current)
        setPolling(false)
        setMessage('✅ Connected! Refreshing...')
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      // ignore
    }
  }

  function startPolling() {
    if (pollTimer.current) clearInterval(pollTimer.current)
    setPolling(true)
    setMessage('')
    doPoll()
    pollTimer.current = setInterval(doPoll, 5000)
  }

  if (telegramChatId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-900 text-sm">Telegram Notifications</h2>
        </div>
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-3">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">Telegram connected</span>
        </div>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="btn-secondary text-xs py-2 px-4 border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2"
        >
          <Unlink className="w-4 h-4" />
          {loading ? 'Disconnecting...' : 'Disconnect Telegram'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="w-5 h-5 text-blue-500" />
        <h2 className="font-semibold text-gray-900 text-sm">Telegram Notifications</h2>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Get real-time notifications in Telegram when work orders are assigned,
        completed, or when you&apos;re mentioned.
      </p>

      {!sent ? (
        <button
          onClick={handleLink}
          disabled={loading}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2"
        >
          <Link className="w-4 h-4" />
          {loading ? 'Generating...' : 'Link Telegram'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-xs text-blue-600 font-medium mb-2">
              Send this code to the bot on Telegram:
            </p>
            <p className="text-2xl font-bold text-blue-700 tracking-widest font-mono select-all">
              {code}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">
              <strong>Step 1:</strong>{' '}
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Open @emerald_maintenance_bot
              </a>
              {' — Telegram will auto-send the code'}
            </p>
            <p className="text-xs text-gray-500">
              <strong>Step 2:</strong> Click <strong>&quot;Check connection&quot;</strong> below
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={startPolling}
              disabled={polling}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              {polling ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Waiting...</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Check connection</>
              )}
            </button>
            <button
              onClick={() => { setSent(false); setCode(''); setMessage(''); if (pollTimer.current) clearInterval(pollTimer.current); setPolling(false) }}
              className="btn-secondary text-xs py-2 px-4"
            >
              Cancel
            </button>
          </div>

          {polling && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Auto-checking every 5 seconds...
            </p>
          )}

          {message && (
            <p className="text-xs font-medium">{message}</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 mt-3">{error}</p>
      )}
    </div>
  )
}
