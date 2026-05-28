import { prisma } from '@/lib/db'
import { sendWebPushNotification } from '@/lib/push'
import { notificationEmitter } from '@/lib/events'

export interface NotificationPayload {
  userId: string
  title: string
  message: string
  type: string // e.g., 'WORK_ORDER_ASSIGNED', 'WORK_ORDER_COMPLETED', 'STOCK_LOW'
  entityId?: string
  href?: string
}

/**
 * Create a notification for a user
 * @param payload - Notification data
 */
export async function createNotification(payload: NotificationPayload) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        entityId: payload.entityId ?? null,
        href: payload.href ?? null,
      },
    })
    
    // Trigger background web push
    await sendWebPushNotification(payload.userId, {
      title: payload.title,
      body: payload.message,
      url: payload.href ?? '/',
      icon: '/assets/logo.png'
    }).catch(err => console.error('Push error:', err))
    
    // Trigger real-time in-app SSE update
    notificationEmitter.emit(`notification:${payload.userId}`)

    return notification
  } catch (error) {
    console.error('Failed to create notification:', error)
    return null
  }
}

/**
 * Create notifications for multiple users
 * @param userIds - Array of user IDs
 * @param payload - Notification data (without userId)
 */
export async function createNotificationForUsers(
  userIds: string[],
  payload: Omit<NotificationPayload, 'userId'>
) {
  try {
    const notifications = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        entityId: payload.entityId ?? null,
        href: payload.href ?? null,
      })),
    })

    // Trigger background web push for all users
    await Promise.allSettled(
      userIds.map(userId => 
        sendWebPushNotification(userId, {
          title: payload.title,
          body: payload.message,
          url: payload.href ?? '/',
          icon: '/assets/logo.png'
        })
      )
    )

    // Trigger real-time in-app SSE updates
    userIds.forEach(userId => {
      notificationEmitter.emit(`notification:${userId}`)
    })

    return notifications
  } catch (error) {
    console.error('Failed to create notifications:', error)
    return null
  }
}
