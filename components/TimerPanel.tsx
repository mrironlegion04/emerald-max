'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, X, Clock } from 'lucide-react'

interface TimerData {
  id: string
  timerStartedAt: string | null
  timerPausedAt: string | null
  timerElapsedSeconds: number
  isTimerActive: boolean
  laborHours: number | null
}

interface Props {
  woId: string
  woStatus: string
  onTimerStop?: (laborHours: number) => void
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  return `${minutes}m ${secs}s`
}

export default function TimerPanel({ woId, woStatus, onTimerStop }: Props) {
  const [timer, setTimer] = useState<TimerData | null>(null)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const canUseTimer = woStatus === 'IN_PROGRESS'

  // Load timer state
  useEffect(() => {
    async function loadTimer() {
      try {
        const res = await fetch(`/api/work-orders/${woId}/timer`)
        if (res.ok) {
          const data = await res.json()
          setTimer(data)
          setDisplaySeconds(data.timerElapsedSeconds)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadTimer()
  }, [woId])

  // Update running timer display
  useEffect(() => {
    if (!timer?.isTimerActive) return

    intervalRef.current = setInterval(() => {
      setDisplaySeconds(prev => prev + 1)
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timer?.isTimerActive])

  // Sync display with actual elapsed when timer state changes
  useEffect(() => {
    if (timer) {
      setDisplaySeconds(timer.timerElapsedSeconds)
    }
  }, [timer?.timerElapsedSeconds])

  async function handleAction(action: 'start' | 'pause' | 'resume' | 'stop') {
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to update timer')
        return
      }

      setTimer(data)
      setDisplaySeconds(data.timerElapsedSeconds)

      if (action === 'stop' && onTimerStop) {
        onTimerStop(data.laborHours)
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return null
  if (!canUseTimer) return null

  return (
    <div className="premium-card p-5 border border-slate-200/50 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <Clock className="w-4.5 h-4.5 text-blue-600" />
        <h3 className="font-bold text-slate-800 text-sm tracking-tight">Work Timer</h3>
      </div>

      {error && <p className="text-xs text-rose-600 mb-3 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">{error}</p>}

      <div className={`rounded-2xl p-6 text-center mb-4 transition-all border ${timer?.isTimerActive ? 'bg-blue-50/20 border-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.05)]' : 'bg-slate-50/50 border-slate-100'}`}>
        <p className={`text-4xl font-mono font-extrabold tracking-wider ${timer?.isTimerActive ? 'text-blue-600' : 'text-slate-800'}`}>
          {formatSeconds(displaySeconds)}
        </p>
        {timer?.isTimerActive && (
          <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mt-1.5 animate-pulse">Running</p>
        )}
        {timer?.laborHours ? (
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Calculated: {timer.laborHours} labor hour{timer.laborHours !== 1 ? 's' : ''}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {!timer?.isTimerActive && !timer?.timerStartedAt ? (
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading}
            className="btn-primary text-xs py-2.5 flex-1 flex items-center justify-center gap-1.5 font-bold shadow-md shadow-blue-50">
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Timer
          </button>
        ) : null}

        {timer?.isTimerActive ? (
          <button
            onClick={() => handleAction('pause')}
            disabled={actionLoading}
            className="btn-secondary text-xs py-2.5 flex-1 flex items-center justify-center gap-1.5 font-bold border-slate-200">
            <Pause className="w-3.5 h-3.5 fill-current" />
            Pause
          </button>
        ) : null}

        {timer?.timerStartedAt && !timer?.isTimerActive ? (
          <button
            onClick={() => handleAction('resume')}
            disabled={actionLoading}
            className="btn-primary text-xs py-2.5 flex-1 flex items-center justify-center gap-1.5 font-bold">
            <Play className="w-3.5 h-3.5 fill-current" />
            Resume
          </button>
        ) : null}

        {timer?.timerStartedAt ? (
          <button
            onClick={() => handleAction('stop')}
            disabled={actionLoading}
            className="btn-secondary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 font-bold border-rose-200 text-rose-600 hover:bg-rose-50 bg-rose-50/40">
            <X className="w-3.5 h-3.5" />
            Stop
          </button>
        ) : null}
      </div>
    </div>
  )
}
