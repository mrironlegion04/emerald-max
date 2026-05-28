'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  showDesktopNotification,
  notificationsEnabled,
  registerServiceWorker,
  requestNotificationPermission,
} from '@/lib/browser-notifications'
import { Bell, X } from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  entityId?: string
  href?: string
  isRead: boolean
  createdAt: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const previousNotificationIdsRef = useRef<Set<string>>(new Set())

  // Fetch unread notifications
  useEffect(() => {
    // Initialize service worker for mobile notifications
    registerServiceWorker()

    // Setup Server-Sent Events (SSE) for real-time in-app updates
    const eventSource = new EventSource('/api/notifications/stream')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Check for new notifications
        if (notificationsEnabled()) {
          data.forEach((notification: Notification) => {
            if (!previousNotificationIdsRef.current.has(notification.id)) {
              // This is a new notification, show browser notification
              showDesktopNotification({
                title: notification.title,
                body: notification.message,
                level: mapNotificationType(notification.type),
                sound: true,
                tag: notification.type, // Prevent duplicate notifications of same type
              })
              // Track this notification ID
              previousNotificationIdsRef.current.add(notification.id)
            }
          })
        }

        setNotifications(data)
        setIsLoading(false)
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      // SSE automatically reconnects, but we can handle errors here
    }

    return () => {
      eventSource.close()
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      })
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      })
      if (response.ok) {
        setNotifications([])
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const unreadCount = notifications.length

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              <p>No new notifications</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className="px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      {notification.href ? (
                        <Link
                          href={notification.href}
                          onClick={() => {
                            handleMarkAsRead(notification.id)
                            setIsOpen(false)
                          }}
                          className="block"
                        >
                          <p className="font-medium text-gray-900 text-sm hover:text-blue-600">
                            {notification.title}
                          </p>
                          <p className="text-gray-600 text-xs line-clamp-2">
                            {notification.message}
                          </p>
                        </Link>
                      ) : (
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {notification.title}
                          </p>
                          <p className="text-gray-600 text-xs line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                      )}
                      <p className="text-gray-400 text-xs mt-1">
                        {formatTime(new Date(notification.createdAt))}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function mapNotificationType(type: string): 'info' | 'success' | 'warning' | 'error' | 'critical' {
  switch (type.toLowerCase()) {
    case 'success':
      return 'success'
    case 'warning':
    case 'alert':
    case 'overdue':
      return 'warning'
    case 'error':
    case 'critical':
      return 'error'
    case 'info':
    case 'workorder':
    case 'team':
    case 'inventory':
    default:
      return 'info'
  }
}
