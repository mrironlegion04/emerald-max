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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-4">
        <Clock className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Work Timer</h3>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-gray-50 rounded-lg p-6 text-center mb-4">
        <p className="text-4xl font-mono font-bold text-gray-900">
          {formatSeconds(displaySeconds)}
        </p>
        {timer?.laborHours ? (
          <p className="text-sm text-gray-500 mt-2">
            Calculated: {timer.laborHours} labor hour{timer.laborHours !== 1 ? 's' : ''}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {!timer?.isTimerActive && !timer?.timerStartedAt ? (
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading}
            className="btn-primary text-sm flex-1 flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            Start Timer
          </button>
        ) : null}

        {timer?.isTimerActive ? (
          <button
            onClick={() => handleAction('pause')}
            disabled={actionLoading}
            className="btn-secondary text-sm flex-1 flex items-center justify-center gap-2">
            <Pause className="w-4 h-4" />
            Pause
          </button>
        ) : null}

        {timer?.timerStartedAt && !timer?.isTimerActive ? (
          <button
            onClick={() => handleAction('resume')}
            disabled={actionLoading}
            className="btn-primary text-sm flex-1 flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            Resume
          </button>
        ) : null}

        {timer?.timerStartedAt ? (
          <button
            onClick={() => handleAction('stop')}
            disabled={actionLoading}
            className="btn-secondary text-sm px-4 flex items-center justify-center gap-2">
            <X className="w-4 h-4" />
            Stop
          </button>
        ) : null}
      </div>
    </div>
  )
}
