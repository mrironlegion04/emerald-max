'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Creates an EventSource that only connects when the browser tab is visible.
 * Closes the connection when the tab is hidden, reconnects when visible.
 * This prevents SSE connection multiplication across multiple tabs.
 */
export function useVisibleEventSource(
  url: string,
  onMessage: (data: unknown) => void,
  onError?: (error: Event) => void,
) {
  const esRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  onMessageRef.current = onMessage
  onErrorRef.current = onError

  const connect = useCallback(() => {
    if (esRef.current) return
    const es = new EventSource(url)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data))
      } catch { /* ignore malformed frames */ }
    }
    es.onerror = (err) => {
      onErrorRef.current?.(err)
      // EventSource auto-reconnects, but if tab is hidden we close
      if (document.visibilityState !== 'visible') {
        es.close()
        esRef.current = null
      }
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  useEffect(() => {
    // Connect only if tab is visible on mount
    if (document.visibilityState === 'visible') {
      connect()
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        connect()
      } else {
        disconnect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      disconnect()
    }
  }, [connect, disconnect])
}
