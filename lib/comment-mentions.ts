import { prisma } from './db'
import { createNotificationForUsers } from './notifications'
import { canViewWorkOrder } from './access-control'

/**
 * Parse @mentions in a comment and notify mentioned users who can view the WO.
 */
export async function notifyMentionedUsers(opts: {
  content: string
  workOrderId: string
  woNumber: string
  userId: string
  userName: string
}) {
  const { content, workOrderId, woNumber, userId, userName } = opts

  const mentionMatches = content.match(/@(\w+)/g)
  if (!mentionMatches || mentionMatches.length === 0) return

  const mentionedNames = [...new Set(mentionMatches.map(m => m.slice(1).toLowerCase()))]

  const mentionedUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: userId },
      name: { contains: mentionedNames.join(' OR '), mode: 'insensitive' },
    },
    select: { id: true, name: true, role: true },
  })

  const matchedUserIds: string[] = []
  for (const uname of mentionedNames) {
    const found = mentionedUsers.find(u =>
      u.name.replace(/\s+/g, '').toLowerCase() === uname
    )
    if (found) matchedUserIds.push(found.id)
  }

  if (matchedUserIds.length === 0) return

  const viewableIds: string[] = []
  for (const uid of matchedUserIds) {
    const mentioned = mentionedUsers.find(u => u.id === uid)
    if (!mentioned) continue
    const access = await canViewWorkOrder({ userId: uid, role: mentioned.role }, workOrderId)
    if (access.allowed) viewableIds.push(uid)
  }

  if (viewableIds.length > 0) {
    await createNotificationForUsers(viewableIds, {
      type: 'CHAT',
      title: `${userName} mentioned you in ${woNumber}`,
      message: content.slice(0, 100),
      href: `/work-orders/${workOrderId}`,
    })
  }
}
