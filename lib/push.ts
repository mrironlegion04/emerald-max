import webpush from 'web-push'
import { prisma } from '@/lib/db'

// Only initialize if keys are present (prevents crash on build or if missing in dev)
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@cmms.local',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function sendWebPushNotification(userId: string, payload: any) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    })

    if (!subscriptions.length) return

    const notifications = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }
      
      return webpush
        .sendNotification(pushSubscription, JSON.stringify(payload))
        .catch((err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('Subscription has expired or is no longer valid: ', err)
            return prisma.pushSubscription.delete({ where: { id: sub.id } })
          } else {
            console.error('Error sending push notification:', err)
          }
        })
    })

    await Promise.all(notifications)
  } catch (error) {
    console.error('Error in sendWebPushNotification:', error)
  }
}
