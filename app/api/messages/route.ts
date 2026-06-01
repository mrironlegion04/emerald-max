import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// Get messages for a channel OR list available channels
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const listChannels = searchParams.get('list_channels') === 'true'

    if (listChannels) {
      // 1. General Channel (Statics)
      const channels = [
        {
          id: 'GENERAL',
          name: 'General System Board',
          type: 'general',
          description: 'Announcements and general discussions for all technicians',
          avatarText: '📢',
        },
      ]

      // 2. Fetch Teams the user belongs to (or all teams for managers/admins)
      try {
        const teams = await prisma.team.findMany({
          where: { isDeleted: false },
          select: { id: true, name: true, trade: true, description: true },
        })

        teams.forEach(team => {
          channels.push({
            id: `TEAM_${team.id}`,
            name: `${team.name} (${team.trade})`,
            type: 'team',
            description: team.description || `Team workspace for ${team.trade}`,
            avatarText: '🛠️',
          })
        })
      } catch (err) {
        console.error('Failed to load teams for messaging:', err)
      }

      // 3. Fetch Active Work Orders (User\'s assigned ones, plus others for admins/managers)
      try {
        const queryConditions: any = {}
        if (user.role === 'TECHNICIAN') {
          queryConditions.OR = [
            { assignedToId: user.userId },
            { createdById: user.userId },
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

        workOrders.forEach(wo => {
          channels.push({
            id: `WO_${wo.id}`,
            name: `${wo.woNumber}: ${wo.title}`,
            type: 'workorder',
            description: `Priority: ${wo.priority} | Status: ${wo.status}`,
            avatarText: '📋',
          })
        })
      } catch (err) {
        console.error('Failed to load work orders for messaging:', err)
      }

      // 4. Fetch Other Users for Direct Messaging
      try {
        const users = await prisma.user.findMany({
          where: {
            isActive: true,
            id: { not: user.userId },
          },
          select: { id: true, name: true, role: true, email: true },
          orderBy: { name: 'asc' },
        })

        users.forEach(otherUser => {
          // Channel ID for DMs of format DIRECT_smallerID_largerID
          const sortedIds = [user.userId, otherUser.id].sort()
          const dmChannelId = `DIRECT_${sortedIds[0]}_${sortedIds[1]}`
          channels.push({
            id: dmChannelId,
            name: otherUser.name,
            type: 'direct',
            description: `Role: ${otherUser.role} | ${otherUser.email}`,
            avatarText: '👤',
          })
        })
      } catch (err) {
        console.error('Failed to load users for direct messaging:', err)
      }

      return NextResponse.json(channels)
    }

    // Otherwise, fetch messages for specific channel
    const channel = searchParams.get('channel') || 'GENERAL'
    
    const messages = await prisma.chatMessage.findMany({
      where: { channel },
      orderBy: { createdAt: 'asc' },
      take: 100, // retrieve last 100 messages for context
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Messages fetch error:', error)
    return NextResponse.json({ error: 'Failed to retrieve messages' }, { status: 500 })
  }
}

// Send a message to a channel
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content, channel, channelName, workOrderId, receiverId, teamId } = await req.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Create the chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        content,
        channel,
        channelName,
        senderId: user.userId,
        senderName: user.name,
        senderRole: user.role,
        workOrderId,
        receiverId,
        teamId,
      },
    })

    return NextResponse.json(chatMessage)
  } catch (error) {
    console.error('Message creation error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
