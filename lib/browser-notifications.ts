// Browser Desktop Notifications with Sound

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error' | 'critical'

interface NotificationOptions {
  title: string
  body: string
  level?: NotificationLevel
  icon?: string
  tag?: string
  sound?: boolean
  badge?: string
  requireInteraction?: boolean
}

interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[]
}

// Play notification sound
function playNotificationSound(level: NotificationLevel = 'info') {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  
  // Different sound patterns for different levels
  const patterns: Record<NotificationLevel, { frequency: number; duration: number; notes: number[] }> = {
    info: { frequency: 800, duration: 200, notes: [800] },
    success: { frequency: 900, duration: 150, notes: [800, 1000] },
    warning: { frequency: 700, duration: 200, notes: [700, 700] },
    error: { frequency: 400, duration: 300, notes: [400, 300, 400] },
    critical: { frequency: 500, duration: 400, notes: [500, 300, 500, 300] },
  }

  const pattern = patterns[level]
  let time = audioContext.currentTime

  for (const freq of pattern.notes) {
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()

    osc.connect(gain)
    gain.connect(audioContext.destination)

    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.01, time + pattern.duration / 1000)

    osc.start(time)
    osc.stop(time + pattern.duration / 1000)

    time += pattern.duration / 1000 + 0.1
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Browser does not support notifications')
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

// Check if notifications are enabled
export function notificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && Notification.permission === 'granted'
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Register Service Worker for mobile notifications
export async function registerServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered:', registration)

      // Only attempt push subscription if we have a VAPID key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (vapidPublicKey && 'pushManager' in registration) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
        
        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          })
        }

        // Save subscription to database
        await fetch('/api/push-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        })
      }

      return registration
    } catch (error) {
      console.error('Service Worker / Push registration failed:', error)
    }
  }
}

// Show desktop notification
export async function showDesktopNotification(options: NotificationOptions): Promise<void> {
  if (!notificationsEnabled()) {
    console.log('Desktop notifications not enabled')
    return
  }

  try {
    const notificationOptions: any = {
      body: options.body,
      icon: options.icon || '/assets/logo.png',
      badge: options.badge || '/assets/logo.png',
      tag: options.tag || 'cmms-notification',
      requireInteraction: options.requireInteraction ?? options.level === 'critical',
      vibrate: [200, 100, 200], // Vibration pattern for mobile
    }

    // Play sound if enabled (default true for critical)
    const shouldPlaySound = options.sound ?? (options.level === 'critical' || options.level === 'error')
    if (shouldPlaySound) {
      playNotificationSound(options.level || 'info')
    }

    // ALWAYS use Service Worker when available
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(options.title, notificationOptions)
      return
    }

    // Desktop fallback
    const notification = new Notification(options.title, notificationOptions)

    // Click handler - navigate if href is provided
    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    // Auto close after 8 seconds (unless requireInteraction)
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 8000)
    }
  } catch (error) {
    console.error('Failed to show desktop notification:', error)
  }
}

// Show notification based on type
export async function notifyWorkOrderAssigned(
  woNumber: string,
  title: string,
  domainName?: string
): Promise<void> {
  await showDesktopNotification({
    title: `Work Order ${woNumber}`,
    body: domainName
      ? `Assigned to industrial domain: ${domainName}`
      : title,
    level: 'info',
    tag: `wo-${woNumber}`,
    sound: true,
  })
}

export async function notifyWorkOrderCompleted(
  woNumber: string,
  title: string
): Promise<void> {
  await showDesktopNotification({
    title: `Work Order ${woNumber} Completed`,
    body: title,
    level: 'success',
    tag: `wo-${woNumber}`,
    sound: true,
  })
}

export async function notifyAlert(
  title: string,
  body: string,
  critical: boolean = false
): Promise<void> {
  await showDesktopNotification({
    title,
    body,
    level: critical ? 'critical' : 'error',
    tag: 'alert',
    sound: true,
    requireInteraction: critical,
  })
}
