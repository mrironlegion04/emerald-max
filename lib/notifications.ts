import { prisma } from '@/lib/db'
import { sendWebPushNotification } from '@/lib/push'
import { notificationEmitter } from '@/lib/events'
import { sendTelegramNotification } from '@/lib/telegram'
import { NotificationType } from '@prisma/client'

export interface NotificationPayload {
  userId: string
  title: string
  message: string
  type: NotificationType // e.g., 'WORK_ORDER_ASSIGNED', 'WORK_ORDER_COMPLETED', 'STOCK_LOW'
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
      icon: '/icon.svg'
    }).catch(err => console.error('Push error:', err))
    
    // Trigger Telegram notification if user has linked their chat
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { telegramChatId: true },
    })
    if (user?.telegramChatId) {
      await sendTelegramNotification(
        user.telegramChatId,
        payload.title,
        payload.message,
        payload.href,
      ).catch(err => console.error('Telegram error:', err))
    }
    
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
          icon: '/icon.svg'
        })
      )
    )

    // Trigger Telegram for users with linked chats
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, telegramChatId: { not: null } },
      select: { telegramChatId: true },
    })
    await Promise.allSettled(
      users.map(u =>
        sendTelegramNotification(
          u.telegramChatId!,
          payload.title,
          payload.message,
          payload.href,
        )
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
