'use client'

import { useEffect, useState } from 'react'
import { requestNotificationPermission, notificationsEnabled } from '@/lib/browser-notifications'

export default function NotificationPermissionRequest() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null)

  useEffect(() => {
    // Check if notifications are available and permission not yet requested
    if ('Notification' in window && Notification.permission === 'default') {
      setShowPrompt(true)
    } else if ('Notification' in window) {
      setPermissionStatus(Notification.permission)
    }
  }, [])

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission()
    setPermissionStatus(granted ? 'granted' : 'denied')
    setShowPrompt(false)
    
    if (granted) {
      // Show a test notification
      new Notification('CMMS Notifications Enabled', {
        body: 'You will now receive desktop notifications for important events.',
        icon: '/assets/logo.png',
      })
    }
  }

  function handleDismiss() {
    setShowPrompt(false)
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-xl border border-blue-200 shadow-lg p-4 max-w-sm z-40 animate-in slide-in-from-bottom-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">Enable Desktop Notifications?</h3>
          <p className="text-xs text-gray-600 mt-1">
            Get instant alerts for work orders, team assignments, and important system events.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-lg"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleEnableNotifications}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
        >
          Enable notifications
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 rounded-lg transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
