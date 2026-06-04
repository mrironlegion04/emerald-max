import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { Prisma } from '@prisma/client'
import { unlink } from 'fs/promises'
import path from 'path'
import { deleteFile } from '@/lib/minio'

// Helper to check if channel exists and dynamically create it if it doesn't
async function ensureChannelExists(channelId: string, currentUserId: string): Promise<boolean> {
  try {
    const channel = await prisma.chatChannel.findUnique({
      where: { id: channelId }
    })
    if (channel) return true

    // Channel does not exist. Let's create it dynamically.
    if (channelId === 'GENERAL') {
      await prisma.chatChannel.create({
        data: {
          id: 'GENERAL',
          name: 'General System Board',
          type: 'general',
          description: 'Announcements and general discussions for all technicians',
          avatarText: '📢',
        }
      })
      return true
    }

    if (channelId.startsWith('WO_')) {
      const woId = channelId.substring(3)
      const wo = await prisma.workOrder.findUnique({
        where: { id: woId },
        select: { id: true, woNumber: true, title: true, priority: true, status: true }
      })
      if (wo) {
        await prisma.chatChannel.create({
          data: {
            id: channelId,
            name: `${wo.woNumber}: ${wo.title}`,
            type: 'workorder',
            description: `Priority: ${wo.priority} | Status: ${wo.status}`,
            avatarText: '📋',
            entityId: wo.id,
          }
        })
        return true
      }
    }

    if (channelId.startsWith('TEAM_')) {
      const teamId = channelId.substring(5)
      const team = await prisma.team.findUnique({
        where: { id: teamId }
      })
      if (team) {
        await prisma.chatChannel.create({
          data: {
            id: channelId,
            name: `${team.name} (${team.trade})`,
            type: 'team',
            description: team.description || `Team workspace for ${team.trade}`,
            avatarText: '🛠️',
            entityId: team.id,
          }
        })
        return true
      }
    }

    if (channelId.startsWith('DIRECT_')) {
      const parts = channelId.replace('DIRECT_', '').split('_')
      const otherUserId = parts.find(p => p !== currentUserId)
      if (otherUserId) {
        const other = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, name: true, role: true, email: true }
        })
        if (other) {
          await prisma.chatChannel.create({
            data: {
              id: channelId,
              name: other.name,
              type: 'direct',
              description: `Role: ${other.role} | ${other.email}`,
              avatarText: '👤',
              entityId: other.id,
            }
          })
          return true
        }
      }
    }

    // Fallback: If we couldn't match or find the entity in DB, create a generic placeholder Channel
    // to absolutely prevent ForeignKey errors of ChatChannelMember.
    let fallbackName = 'Discussion Room'
    let fallbackType = 'general'
    let fallbackText = '💬'
    if (channelId.startsWith('WO_')) {
      fallbackName = `Work Order Room (${channelId.substring(3).substring(0, 6)})`
      fallbackType = 'workorder'
      fallbackText = '📋'
    } else if (channelId.startsWith('TEAM_')) {
      fallbackName = 'Team Space'
      fallbackType = 'team'
      fallbackText = '🛠️'
    } else if (channelId.startsWith('DIRECT_')) {
      fallbackName = 'Private Chat'
      fallbackType = 'direct'
      fallbackText = '👤'
    }

    await prisma.chatChannel.create({
      data: {
        id: channelId,
        name: fallbackName,
        type: fallbackType,
        description: 'Dynamically initialized active session room',
        avatarText: fallbackText,
      }
    })
    return true
  } catch (err) {
    console.error('Error in ensureChannelExists:', err)
    return false
  }
}

// Ensure static channels exist in PostgreSQL and add memberships
async function ensureStaticAndDirectChannels(userId: string, role: string) {
  try {
    // 1. Ensure GENERAL flat system channel exists
    const generalChannelId = 'GENERAL'
    let generalChan = await prisma.chatChannel.findUnique({ where: { id: generalChannelId } })
    if (!generalChan) {
      generalChan = await prisma.chatChannel.create({
        data: {
          id: generalChannelId,
          name: 'General System Board',
          type: 'general',
          description: 'Announcements and general discussions for all technicians',
          avatarText: '📢',
        },
      })
    }
    await prisma.chatChannelMember.upsert({
      where: { channelId_userId: { channelId: generalChannelId, userId } },
      update: {},
      create: { channelId: generalChannelId, userId },
    })

    // 2. Sync Teams
    const teams = await prisma.team.findMany({ where: { isDeleted: false } })
    for (const team of teams) {
      const teamChannelId = `TEAM_${team.id}`
      let teamChan = await prisma.chatChannel.findUnique({ where: { id: teamChannelId } })
      if (!teamChan) {
        teamChan = await prisma.chatChannel.create({
          data: {
            id: teamChannelId,
            name: `${team.name} (${team.trade})`,
            type: 'team',
            description: team.description || `Team workspace for ${team.trade}`,
            avatarText: '🛠️',
            entityId: team.id,
          },
        })
      }

      // Technicians must belong to the team to join, managers/admins get auto-joined
      const isTeamMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: team.id, userId } },
      })
      if (isTeamMember || role === 'ADMIN' || role === 'MANAGER') {
        await prisma.chatChannelMember.upsert({
          where: { channelId_userId: { channelId: teamChannelId, userId } },
          update: {},
          create: { channelId: teamChannelId, userId },
        })
      }
    }

    // 3. Sync Active Work Orders
    const queryConditions: Prisma.WorkOrderWhereInput = {}
    if (role === 'TECHNICIAN') {
      queryConditions.OR = [
        { assignedToId: userId },
        { createdById: userId },
      ]
    }
    const workOrders = await prisma.workOrder.findMany({
      where: {
        ...queryConditions,
        status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: { id: true, woNumber: true, title: true, priority: true, status: true },
      orderBy: { woNumber: 'desc' },
      take: 30,
    })

    for (const wo of workOrders) {
      const woChannelId = `WO_${wo.id}`
      let woChan = await prisma.chatChannel.findUnique({ where: { id: woChannelId } })
      if (!woChan) {
        woChan = await prisma.chatChannel.create({
          data: {
            id: woChannelId,
            name: `${wo.woNumber}: ${wo.title}`,
            type: 'workorder',
            description: `Priority: ${wo.priority} | Status: ${wo.status}`,
            avatarText: '📋',
            entityId: wo.id,
          },
        })
      }
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId: woChannelId, userId } },
        update: {},
        create: { channelId: woChannelId, userId },
      })
    }

    // 4. Sync Other Users as standard DIRECT DMs
    const otherUsers = await prisma.user.findMany({
      where: { isActive: true, id: { not: userId } },
      select: { id: true, name: true, role: true, email: true },
      take: 50,
    })

    for (const other of otherUsers) {
      const sortedIds = [userId, other.id].sort()
      const dmChannelId = `DIRECT_${sortedIds[0]}_${sortedIds[1]}`
      let dmChan = await prisma.chatChannel.findUnique({ where: { id: dmChannelId } })
      if (!dmChan) {
        dmChan = await prisma.chatChannel.create({
          data: {
            id: dmChannelId,
            name: other.name,
            type: 'direct',
            description: `Role: ${other.role} | ${other.email}`,
            avatarText: '👤',
            entityId: other.id,
          },
        })
      }
      // Upsert memberships
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId: dmChannelId, userId } },
        update: {},
        create: { channelId: dmChannelId, userId },
      })
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId: dmChannelId, userId: other.id } },
        update: {},
        create: { channelId: dmChannelId, userId: other.id },
      })
    }
  } catch (err) {
    console.error('ensureStaticAndDirectChannels discrepancy:', err)
  }
}

// Get messages for a channel OR list available channels
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const listChannels = searchParams.get('list_channels') === 'true'
    const pollUnreads = searchParams.get('poll_unreads') === 'true'

    if (pollUnreads) {
      try {
        const userMemberships = await prisma.chatChannelMember.findMany({
          where: { userId: user.userId, isArchived: false },
          select: { channelId: true },
        })
        const channelsJoined = userMemberships.map(m => m.channelId)

        const recentMessages = await prisma.chatMessage.findMany({
          where: {
            channelId: { in: channelsJoined },
            createdAt: { gte: new Date(Date.now() - 30000) }, // last 30 seconds
            senderId: { not: user.userId },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
        return NextResponse.json(recentMessages)
      } catch (err) {
        console.error('Failed to poll recent messages:', err)
        return NextResponse.json([])
      }
    }

    if (listChannels) {
      // Refresh DB static/direct structures dynamically
      await ensureStaticAndDirectChannels(user.userId, user.role)

      // Fetch all memberships (includes general, teams, WOs, groups, and active DMs)
      const memberships = await prisma.chatChannelMember.findMany({
        where: { userId: user.userId, isArchived: false },
        include: {
          channel: {
            include: {
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      })

      const channelList = []
      for (const m of memberships) {
        const channelId = m.channelId
        const type = m.channel.type
        let name = m.channel.name
        let description = m.channel.description || ''

        // Dynamic DM name rendering
        if (type === 'direct') {
          const partnerId = m.channel.id.replace('DIRECT_', '').replace(user.userId, '').replace('_', '')
          const partner = await prisma.user.findUnique({
            where: { id: partnerId },
            select: { name: true, role: true, email: true },
          })
          if (partner) {
            name = partner.name
            description = `Role: ${partner.role} | ${partner.email}`
          }
        }

        // Calculate actual unread counts
        const unreadCount = await prisma.chatMessage.count({
          where: {
            channelId,
            createdAt: { gt: m.lastReadAt },
            senderId: { not: user.userId },
          },
        })

        // Also compile group members if applicable
        const memberIds = m.channel.members.map(member => member.userId)

        channelList.push({
          id: channelId,
          name,
          type,
          description,
          avatarText: m.channel.avatarText || '💬',
          isMuted: m.isMuted,
          isPinned: m.isPinned,
          unreadCount,
          memberIds,
        })
      }

      // Sort: pinned top first, then regular
      channelList.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return 0
      })

      return NextResponse.json(channelList)
    }

    // Feed room details / Message lists
    const channelId = searchParams.get('channel') || 'GENERAL'
    const parentId = searchParams.get('parentId') || undefined // For threaded replies
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Update read receipt state to "now" since they are viewing this room (only if fetching room feed, not thread feed)
    if (!parentId) {
      await ensureChannelExists(channelId, user.userId)
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId, userId: user.userId } },
        update: { lastReadAt: new Date() },
        create: { channelId, userId: user.userId, lastReadAt: new Date() },
      })
    }

    // Query messages
    const messages = await prisma.chatMessage.findMany({
      where: {
        channelId,
        parentId: parentId || null, // If parentId is not specified, only load parent/top-level messages!
      },
      include: {
        replies: {
          select: {
            id: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const messagesWithCount = messages.map(msg => {
      const { replies, ...rest } = msg
      return {
        ...rest,
        repliesCount: replies ? replies.length : 0
      }
    })

    return NextResponse.json(messagesWithCount.reverse())
  } catch (error) {
    console.error('Messages fetch error:', error)
    return NextResponse.json({ error: 'Failed to retrieve messages' }, { status: 500 })
  }
}

// Send a message to a channel OR create a group chat
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      createGroup,
      groupName,
      groupDesc,
      memberIds,
      content,
      channel: channelId,
      channelName,
      workOrderId,
      receiverId,
      teamId,
      mediaUrl,
      mediaName,
      mediaType,
      isVoice,
      voiceDuration,
      parentId, // Thread parent reference
    } = body

    // 1. Relational database-backed Group Chat Creation
    if (createGroup) {
      if (!groupName || !groupName.trim()) {
        return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
      }
      const groupChannelId = `GROUP_${Date.now()}`
      const chatChannel = await prisma.chatChannel.create({
        data: {
          id: groupChannelId,
          name: groupName.trim(),
          type: 'group',
          description: groupDesc ? groupDesc.trim() : 'Private crew workspace',
          avatarText: '👥',
        },
      })

      // Add membership for the creator
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId: groupChannelId, userId: user.userId } },
        update: {},
        create: { channelId: groupChannelId, userId: user.userId, lastReadAt: new Date() },
      })

      // Add memberships for invited colleagues
      if (Array.isArray(memberIds)) {
        for (const mId of memberIds) {
          await prisma.chatChannelMember.upsert({
            where: { channelId_userId: { channelId: groupChannelId, userId: mId } },
            update: {},
            create: { channelId: groupChannelId, userId: mId, lastReadAt: new Date() },
          })
        }
      }

      // Emit welcome intro log in newly created room
      await prisma.chatMessage.create({
        data: {
          content: `👥 Welcome to the "${groupName}" Crew Chatroom. Setup isolated communication!`,
          channelId: groupChannelId,
          channel: groupChannelId,
          channelName: groupName.trim(),
          senderId: user.userId,
          senderName: user.name,
          senderRole: user.role,
        },
      })

      return NextResponse.json(chatChannel)
    }

    // 2. Normal Message transmission
    if ((!content || !content.trim()) && !mediaUrl) {
      return NextResponse.json({ error: 'Content or media is required' }, { status: 400 })
    }

    // Ensure target chat room persists in DB
    let channelRecord = await prisma.chatChannel.findUnique({ where: { id: channelId } })
    if (!channelRecord) {
      // Determine type from channel prefix
      let type = 'general'
      if (channelId.startsWith('TEAM_')) type = 'team'
      else if (channelId.startsWith('WO_')) type = 'workorder'
      else if (channelId.startsWith('DIRECT_')) type = 'direct'
      else if (channelId.startsWith('GROUP_')) type = 'group'

      channelRecord = await prisma.chatChannel.create({
        data: {
          id: channelId,
          name: channelName || 'Crew Space',
          type,
          description: type === 'group' ? 'Private group conversation' : 'Discussion zone',
          avatarText: type === 'workorder' ? '📋' : type === 'team' ? '🛠️' : type === 'direct' ? '👤' : '👥',
          entityId: workOrderId || teamId || receiverId || null,
        },
      })
    }

    // Ensure sender has membership
    await prisma.chatChannelMember.upsert({
      where: { channelId_userId: { channelId, userId: user.userId } },
      update: { lastReadAt: new Date() },
      create: { channelId, userId: user.userId, lastReadAt: new Date() },
    })

    // Create the message database-backed record
    const chatMessage = await prisma.chatMessage.create({
      data: {
        content: content || '',
        channelId,
        channel: channelId,
        channelName: channelName || 'Crew Space',
        senderId: user.userId,
        senderName: user.name,
        senderRole: user.role,
        workOrderId: workOrderId || null,
        receiverId: receiverId || null,
        teamId: teamId || null,
        mediaUrl: mediaUrl || null,
        mediaName: mediaName || null,
        mediaType: mediaType || null,
        isVoice: !!isVoice,
        voiceDuration: voiceDuration || null,
        parentId: parentId || null,
      },
    })

    // Push active system notifications for other members of the channel
    const otherMembers = await prisma.chatChannelMember.findMany({
      where: { channelId, userId: { not: user.userId }, isMuted: false },
      select: { userId: true },
    })

    for (const member of otherMembers) {
      await prisma.notification.create({
        data: {
          userId: member.userId,
          title: `Message inside ${channelName || 'Crew Chat'}`,
          message: `${user.name}: ${content ? (content.substring(0, 60) + (content.length > 60 ? '...' : '')) : 'Sent an attachment'}`,
          type: 'CHAT',
          entityId: chatMessage.id,
          href: `/messages?channel=${channelId}`,
          isRead: false,
        },
      })
    }

    return NextResponse.json(chatMessage)
  } catch (error) {
    console.error('Message creation error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}

// Update/edit an existing message OR update channel preferences
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // 1. Check if modifying a group chat channel definition
    if (body.updateGroup && body.channelId) {
      const { channelId, groupName, groupDesc, memberIds } = body
      const updatedChannel = await prisma.chatChannel.update({
        where: { id: channelId },
        data: {
          name: groupName ? groupName.trim() : undefined,
          description: groupDesc !== undefined ? groupDesc.trim() : undefined,
        },
      })

      if (Array.isArray(memberIds)) {
        // Delete older associated memberships (except the current user)
        await prisma.chatChannelMember.deleteMany({
          where: {
            channelId,
            userId: { not: user.userId },
          },
        })

        // Insert/refresh selected direct additions
        for (const mId of memberIds) {
          await prisma.chatChannelMember.upsert({
            where: { channelId_userId: { channelId, userId: mId } },
            update: {},
            create: { channelId, userId: mId, lastReadAt: new Date() },
          })
        }
      }

      return NextResponse.json(updatedChannel)
    }

    // 2. Check if updating channel membership preferences
    if (body.channelId) {
      const { channelId, isPinned, isMuted, isArchived } = body
      const updatedPreference = await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId, userId: user.userId } },
        update: {
          isPinned: isPinned !== undefined ? isPinned : undefined,
          isMuted: isMuted !== undefined ? isMuted : undefined,
          isArchived: isArchived !== undefined ? isArchived : undefined,
        },
        create: {
          channelId,
          userId: user.userId,
          isPinned: isPinned !== undefined ? isPinned : false,
          isMuted: isMuted !== undefined ? isMuted : false,
          isArchived: isArchived !== undefined ? isArchived : false,
        },
      })
      return NextResponse.json(updatedPreference)
    }

    // 2. Otherwise update message text
    const { id, content } = body
    if (!id || !content || !content.trim()) {
      return NextResponse.json({ error: 'Invalid message update request' }, { status: 400 })
    }

    const msg = await prisma.chatMessage.findUnique({ where: { id } })
    if (!msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (msg.senderId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.chatMessage.update({
      where: { id },
      data: {
        content,
        isEdited: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Message update error:', error)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }
}

// Soft delete a message
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const msg = await prisma.chatMessage.findUnique({ where: { id } })
    if (!msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Authorization: sender or high-role managers
    if (msg.senderId !== user.userId && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Process media/file deletion if present
    if (msg.mediaUrl) {
      try {
        const isMinIO = !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
        if (isMinIO && msg.mediaUrl.includes('?')) {
          const urlObj = new URL(msg.mediaUrl)
          const pathname = decodeURIComponent(urlObj.pathname.replace(/^\//, ''))
          const parts = pathname.split('/')
          if (parts.length > 1) {
            const objectName = parts.slice(1).join('/') // strip off the bucket name prefix
            await deleteFile(objectName)
            console.log(`Deleted chat attachment from MinIO: ${objectName}`)
          }
        } else if (msg.mediaUrl.startsWith('/uploads/')) {
          const filename = path.basename(msg.mediaUrl)
          const filepath = path.join(process.cwd(), 'public', 'uploads', filename)
          await unlink(filepath)
          console.log(`Deleted chat attachment locally: ${filename}`)
        }
      } catch (err) {
        console.error('Failed to delete chat file attachment:', err)
      }
    }

    const deleted = await prisma.chatMessage.update({
      where: { id },
      data: {
        content: '🗑️ This message was deleted.',
        isDeleted: true,
        mediaUrl: null,
        mediaName: null,
        mediaType: null,
      },
    })

    return NextResponse.json(deleted)
  } catch (error) {
    console.error('Message delete error:', error)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}
