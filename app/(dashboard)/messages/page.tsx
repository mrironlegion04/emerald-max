'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send,
  Search,
  MessageCircle,
  Users,
  ClipboardList,
  User,
  ExternalLink,
  RefreshCw,
  Loader2,
  Bookmark,
  ArrowLeft,
  Pin,
  VolumeX,
  EyeOff,
  MoreVertical,
  Mic,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Edit2,
  CornerDownRight,
  Plus,
  X,
  Link2,
  Play,
  Pause,
  ShieldAlert,
  Sparkles,
  FileCheck,
  CheckCheck
} from 'lucide-react'

// Extended channel types
interface ChatChannel {
  id: string
  name: string
  type: 'general' | 'team' | 'workorder' | 'direct' | 'group'
  description: string
  avatarText: string
}

// Extended message type matching schema database rows + rich mock elements
interface ChatMessage {
  id: string
  content: string
  channel: string
  channelName: string
  senderId: string
  senderName: string
  senderRole: string
  createdAt: string
  isEdited?: boolean
  isDeleted?: boolean
  isVoice?: boolean
  voiceDuration?: string
  mediaUrl?: string
  mediaName?: string
  convertedWOId?: string
  convertedWONumber?: string
}

interface ThreadReply {
  id: string
  content: string
  senderId: string
  senderName: string
  senderRole: string
  createdAt: string
}

export default function MessagesPage() {
  const router = useRouter()
  
  // Base State
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [dbChannels, setDbChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'team' | 'workorder' | 'direct' | 'group'>('all')
  
  // Loaders
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Pin, Mute, Private Channels (LocalStorage-driven)
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [mutedIds, setMutedIds] = useState<string[]>([])
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [unreadIds, setUnreadIds] = useState<string[]>([])
  
  // Custom Local Group Chats
  const [customGroups, setCustomGroups] = useState<ChatChannel[]>([])
  
  // Dialog/Modal UI states
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showHiddenManager, setShowHiddenManager] = useState(false)
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false)
  
  // Group creation form
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([])

  // Convert message to Work Order form
  const [convertingMessage, setConvertingMessage] = useState<ChatMessage | null>(null)
  const [woTitle, setWoTitle] = useState('')
  const [woPriority, setWoPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [woType, setWoType] = useState<'BREAKDOWN' | 'PREVENTIVE' | 'PREDICTIVE'>('BREAKDOWN')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('')
  const [isConvertingWO, setIsConvertingWO] = useState(false)

  // System options loading
  const [systemAssets, setSystemAssets] = useState<any[]>([])
  const [systemLocations, setSystemLocations] = useState<any[]>([])
  const [systemUsers, setSystemUsers] = useState<any[]>([])

  // Action channel menu active state
  const [menuOpenChanId, setMenuOpenChanId] = useState<string | null>(null)

  // Edit inline message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingMsgContent, setEditingMsgContent] = useState('')

  // Side Thread System (Side Conversations)
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null)
  const [threadReplies, setThreadReplies] = useState<ThreadReply[]>([])
  const [newThreadText, setNewThreadText] = useState('')

  // Voice recording mock simulation states
  const [isRecording, setIsRecording] = useState(false)
  const [recordTimer, setRecordTimer] = useState(0)
  const [audioBlobTranscribed, setAudioBlobTranscribed] = useState<string | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Image/Rich Media Panel state
  const [showMediaPresets, setShowMediaPresets] = useState(false)
  const [selectedMediaPreset, setSelectedMediaPreset] = useState<{ url: string; name: string } | null>(null)

  // @Mentions feature dropdown indices
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([])
  const [focusedMentionIndex, setFocusedMentionIndex] = useState(0)
  const mentionDropdownRef = useRef<HTMLDivElement>(null)

  // Toast / Status notify banner overlay
  const [notificationToast, setNotificationToast] = useState<string | null>(null)

  // Message specific highlighted (link copy jump tag)
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null)

  // Scrollers
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Diagnostic presets for media tests
  const industrialMediaPresets = [
    { name: '⚡ Circuit Breaker Blown', url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=400&q=80' },
    { name: '🌊 Boiler Room Pipe Leak', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80' },
    { name: '🔥 Engine Overheating HVAC', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80' },
    { name: '⚙️ Ruptured Belt Gear', url: 'https://images.unsplash.com/photo-1530124560072-a059b014b37d?auto=format&fit=crop&w=400&q=80' },
  ]

  // Fetch current user session
  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setCurrentUser(data)
        } else {
          router.push('/login')
        }
      } catch (err) {
        console.error('Failed to parse user state:', err)
      }
    }
    loadCurrentUser()
  }, [router])

  // Hydrate custom lists & settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setPinnedIds(JSON.parse(localStorage.getItem('maintainx_msg_pinned') || '[]'))
        setMutedIds(JSON.parse(localStorage.getItem('maintainx_msg_muted') || '[]'))
        setHiddenIds(JSON.parse(localStorage.getItem('maintainx_msg_hidden') || '[]'))
        setUnreadIds(JSON.parse(localStorage.getItem('maintainx_msg_unread') || '[]'))
        setCustomGroups(JSON.parse(localStorage.getItem('maintainx_msg_custom_groups') || '[]'))
        
        // Read URL variables for Message Links
        const params = new URLSearchParams(window.location.search)
        const targetMsg = params.get('msgId')
        const targetChan = params.get('channel')
        if (targetMsg) {
          setHighlightedMsgId(targetMsg)
          setTimeout(() => {
            const el = document.getElementById(`msg-${targetMsg}`)
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 1000)
        }
      } catch (e) {
        console.error('Error parsing localStorage:', e)
      }
    }
  }, [])

  // Write changes to localStorage
  const savePreference = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data))
  }

  // Fetch API Channels and link up with group-chats
  useEffect(() => {
    async function loadChannels() {
      try {
        setLoadingChannels(true)
        const res = await fetch('/api/messages?list_channels=true')
        if (res.ok) {
          const data = await res.json()
          setDbChannels(data)
          
          // Select default channel
          const generalChan = data.find((c: any) => c.id === 'GENERAL')
          if (generalChan && !activeChannel) {
            setActiveChannel(generalChan)
          } else if (data.length > 0 && !activeChannel) {
            setActiveChannel(data[0])
          }
        }
      } catch (err) {
        console.error('Failed to retrieve routes or channels:', err)
      } finally {
        setLoadingChannels(false)
      }
    }
    loadChannels()
  }, [])

  // Combine database channels and custom temporary groups
  const allChannelsCombined = [...dbChannels, ...customGroups]

  // Retrieve messages for selected active channel
  const fetchMessagesRef = useRef<() => Promise<void>>(async () => {})

  fetchMessagesRef.current = async () => {
    if (!activeChannel) return

    // If channel is custom group chat, load from localStorage
    if (activeChannel.type === 'group') {
      try {
        const cached = JSON.parse(localStorage.getItem(`maintainx_messages_group_${activeChannel.id}`) || '[]')
        setMessages(cached)
      } catch (e) {
        setMessages([])
      }
      return
    }

    try {
      const res = await fetch(`/api/messages?channel=${activeChannel.id}`)
      if (res.ok) {
        const data = await res.json()
        
        // Read client edits or deleted items if saved locally (simulated edits/deletes)
        const localEdits = JSON.parse(localStorage.getItem('maintainx_msg_local_edits') || '{}')
        const localDeletes = JSON.parse(localStorage.getItem('maintainx_msg_local_deletes') || '[]')
        
        const modifiedData = data.map((msg: ChatMessage) => {
          if (localDeletes.includes(msg.id)) {
            return { ...msg, isDeleted: true, content: '🗑️ Action undo: This message was deleted.' }
          }
          if (localEdits[msg.id]) {
            return { ...msg, isEdited: true, content: localEdits[msg.id] }
          }
          return msg
        })
        
        setMessages(modifiedData)
      }
    } catch (err) {
      console.error('Failed syncing cloud message feed:', err)
    }
  }

  // Load on channel transfer
  useEffect(() => {
    if (!activeChannel) return
    async function loadMessages() {
      try {
        setLoadingMessages(true)
        await fetchMessagesRef.current()
        
        // Remove unread state on select
        if (unreadIds.includes(activeChannel.id)) {
          const upd = unreadIds.filter(id => id !== activeChannel.id)
          setUnreadIds(upd)
          savePreference('maintainx_msg_unread', upd)
        }

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 150)
      } catch (err) {
        console.error('Failed to trigger message pull:', err)
      } finally {
        setLoadingMessages(false)
      }
    }
    loadMessages()
    setThreadParent(null) // Reset active threads sidebar
  }, [activeChannel])

  // Short-polling interval (3s) for rich live response
  useEffect(() => {
    if (!activeChannel) return
    const interval = setInterval(() => {
      fetchMessagesRef.current()
    }, 3000)
    return () => clearInterval(interval)
  }, [activeChannel])

  // Scroll anchor watcher
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Pull thread comments whenever active parent thread changes
  useEffect(() => {
    if (!threadParent) return
    try {
      const parentId = threadParent.id
      const loaded = JSON.parse(localStorage.getItem(`maintainx_thread_replies_${parentId}`) || '[]')
      setThreadReplies(loaded)
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (e) {
      setThreadReplies([])
    }
  }, [threadParent])

  // Trigger loading system items for modal directories
  const prepareSystemFormOptions = async () => {
    try {
      // 1. Fetch Assets
      const assetsRes = await fetch('/api/assets')
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json()
        setSystemAssets(assetsData)
        if (assetsData.length > 0) setSelectedAssetId(assetsData[0].id)
      }

      // 2. Fetch Locations
      const locRes = await fetch('/api/locations')
      if (locRes.ok) {
        const locationsData = await locRes.json()
        setSystemLocations(locationsData)
        if (locationsData.length > 0) setSelectedLocationId(locationsData[0].id)
      }

      // 3. Extract other system users
      const usersList = dbChannels
        .filter(c => c.type === 'direct')
        .map(c => ({ id: c.id.substring(7).split('_').find(x => x !== currentUser?.userId), name: c.name }))
        .filter(u => u.id)
      
      setSystemUsers(usersList)
      if (usersList.length > 0) setSelectedAssigneeId(usersList[0].id || '')
    } catch (err) {
      console.error('Failed pulling asset or user dropdown catalogs:', err)
    }
  }

  // Handle message send
  const triggerSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!activeChannel || !currentUser) return

    // Normal message or Rich Presets
    const isAttachment = !!selectedMediaPreset
    const contentText = newMessage.trim()
    
    if (!contentText && !isAttachment && !audioBlobTranscribed) return

    setIsSending(true)
    const activeMsgVal = contentText || (audioBlobTranscribed ? `🎤 [Voice Clip: ${audioBlobTranscribed}]` : '📎 Sent attachment image')

    const optimisticId = `message_${Date.now()}`
    const optimisticMock: ChatMessage = {
      id: optimisticId,
      content: activeMsgVal,
      channel: activeChannel.id,
      channelName: activeChannel.name,
      senderId: currentUser.userId || currentUser.id,
      senderName: currentUser.name || currentUser.userId || 'User',
      senderRole: currentUser.role || 'USER',
      createdAt: new Date().toISOString(),
      isVoice: !!audioBlobTranscribed,
      voiceDuration: audioBlobTranscribed ? `${recordTimer}s` : undefined,
      mediaUrl: selectedMediaPreset?.url || undefined,
      mediaName: selectedMediaPreset?.name || undefined,
    }

    // Append to list instant view
    setMessages(prev => [...prev, optimisticMock])
    setNewMessage('')
    setAudioBlobTranscribed(null)
    setSelectedMediaPreset(null)
    setShowMediaPresets(false)
    setRecordTimer(0)

    // Mention trigger logic check
    if (activeMsgVal.includes('@')) {
      triggerMentionAlert(activeMsgVal)
    }

    // 1. Group Channel Storage Mode
    if (activeChannel.type === 'group') {
      try {
        const groupKey = `maintainx_messages_group_${activeChannel.id}`
        const currentM = JSON.parse(localStorage.getItem(groupKey) || '[]')
        const updatedM = [...currentM, optimisticMock]
        localStorage.setItem(groupKey, JSON.stringify(updatedM))
        
        // Simulating artificial response from team within 2 seconds
        simulateTeamResponse(activeMsgVal, activeChannel.id)
        
        setTimeout(() => {
          fetchMessagesRef.current()
        }, 100)
      } catch (err) {
        console.error(err)
      } finally {
        setIsSending(false)
      }
      return
    }

    // 2. Normal Database post sync
    try {
      let workOrderId: string | undefined
      let teamId: string | undefined
      let receiverId: string | undefined

      if (activeChannel.type === 'workorder') {
        workOrderId = activeChannel.id.substring(3)
      } else if (activeChannel.type === 'team') {
        teamId = activeChannel.id.substring(5)
      } else if (activeChannel.type === 'direct') {
        const ids = activeChannel.id.substring(7).split('_')
        const myId = currentUser.userId || currentUser.id
        receiverId = ids.find(id => id !== myId)
      }

      const postBody = {
        content: optimisticMock.mediaUrl 
          ? `${activeMsgVal} \n[Attachment: ${optimisticMock.mediaName} - Image: ${optimisticMock.mediaUrl}]`
          : activeMsgVal,
        channel: activeChannel.id,
        channelName: activeChannel.name,
        workOrderId,
        teamId,
        receiverId,
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
      })

      if (!res.ok) {
        console.error('Failed submitting message database route')
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      } else {
        await fetchMessagesRef.current()
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setIsSending(false)
    }
  }

  // Artificial Group responses simulating realistic MaintainX technician alerts
  const simulateTeamResponse = (msgVal: string, chanId: string) => {
    setTimeout(() => {
      const simulatedReplies = [
        "Roger that, headed to location now.",
        "Check. Let me grab the tools from the janitorial locker.",
        "Thanks for the heads-up. Pressure values look stable from my desk.",
        "I can support that! Let's schedule it for 2 PM shift.",
        "Is that logged under safety procedures? Please confirm."
      ]
      const randomText = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)]
      const responseMock: ChatMessage = {
        id: `simulate_${Date.now()}`,
        content: `💬 [Crew Alert Response] ${randomText}`,
        channel: chanId,
        channelName: 'Team Discussion Thread',
        senderId: 'mock_tech_lucas',
        senderName: 'Lucas Vance (Technician)',
        senderRole: 'TECHNICIAN',
        createdAt: new Date().toISOString()
      }

      const key = `maintainx_messages_group_${chanId}`
      const cur = JSON.parse(localStorage.getItem(key) || '[]')
      const updated = [...cur, responseMock]
      localStorage.setItem(key, JSON.stringify(updated))

      setNotificationToast("🔔 Lucas Vance replied in the Group Chat!")

      if (activeChannel?.id === chanId) {
        setMessages(updated)
      }
    }, 2500)
  }

  // Action Menu Channel changes (Pin, Mute, Hide etc.)
  const togglePinChannel = (id: string) => {
    let newPinned = [...pinnedIds]
    if (newPinned.includes(id)) {
      newPinned = newPinned.filter(p => p !== id)
      displayToast("📌 Channel unpinned from top list")
    } else {
      newPinned.push(id)
      displayToast("📌 Channel locked and pinned to top")
    }
    setPinnedIds(newPinned)
    savePreference('maintainx_msg_pinned', newPinned)
    setMenuOpenChanId(null)
  }

  const toggleMuteChannel = (id: string) => {
    let newMutes = [...mutedIds]
    if (newMutes.includes(id)) {
      newMutes = newMutes.filter(m => m !== id)
      displayToast("🔊 Notifications restored")
    } else {
      newMutes.push(id)
      displayToast("🔇 Notifications silenced for room")
    }
    setMutedIds(newMutes)
    savePreference('maintainx_msg_muted', newMutes)
    setMenuOpenChanId(null)
  }

  const hideChannelItem = (id: string) => {
    const newHiddens = [...hiddenIds, id]
    setHiddenIds(newHiddens)
    savePreference('maintainx_msg_hidden', newHiddens)
    displayToast("👁️ Channel removed/archived from main view")
    setMenuOpenChanId(null)
    
    if (activeChannel?.id === id) {
      const rest = allChannelsCombined.filter(c => !newHiddens.includes(c.id))
      setActiveChannel(rest.length > 0 ? rest[0] : null)
    }
  }

  const restoreHiddenChannel = (id: string) => {
    const upd = hiddenIds.filter(x => x !== id)
    setHiddenIds(upd)
    savePreference('maintainx_msg_hidden', upd)
    displayToast("👁️ Communication channel restored")
  }

  const markChannelAsUnread = (id: string) => {
    if (!unreadIds.includes(id)) {
      const upd = [...unreadIds, id]
      setUnreadIds(upd)
      savePreference('maintainx_msg_unread', upd)
      displayToast("✉️ Room flagged as Unread")
    }
    setMenuOpenChanId(null)
  }

  const displayToast = (msg: string) => {
    setNotificationToast(msg)
    setTimeout(() => {
      setNotificationToast(null)
    }, 3000)
  }

  // Group creation confirmation
  const createCustomGroupChat = () => {
    if (!newGroupName.trim()) return
    
    const newId = `GROUP_${Date.now()}`
    const membersName = dbChannels
      .filter(c => c.type === 'direct')
      .filter(c => {
        const otherId = c.id.substring(7).split('_').find(x => x !== currentUser?.userId)
        return otherId && selectedGroupMembers.includes(otherId)
      })
      .map(c => c.name)
      .join(', ')

    const newGroupChannel: ChatChannel = {
      id: newId,
      name: newGroupName,
      type: 'group',
      description: newGroupDesc || `Private crew room: ${membersName || 'Empty'}`,
      avatarText: '👥'
    }

    const updatedGroups = [...customGroups, newGroupChannel]
    setCustomGroups(updatedGroups)
    savePreference('maintainx_msg_custom_groups', updatedGroups)

    // Seed group with an intro message
    const intro: ChatMessage = {
      id: `sys_${Date.now()}`,
      content: `👥 Welcome to the "${newGroupName}" Crew Chatroom. Setup isolated communication!`,
      channel: newId,
      channelName: newGroupName,
      senderId: 'system',
      senderName: 'System Bot',
      senderRole: 'ADMIN',
      createdAt: new Date().toISOString()
    }
    localStorage.setItem(`maintainx_messages_group_${newId}`, JSON.stringify([intro]))

    setShowCreateGroup(false)
    setNewGroupName('')
    setNewGroupDesc('')
    setSelectedGroupMembers([])
    setActiveChannel(newGroupChannel)
    displayToast(`✨ Group Chat "${newGroupName}" assembled!`)
  }

  // Mention system popup trigger
  const triggerMentionAlert = (text: string) => {
    const splitWords = text.split(' ')
    const lastWord = splitWords[splitWords.length - 1]
    if (lastWord.startsWith('@')) {
      const query = lastWord.substring(1)
      setMentionQuery(query)
      
      const suggestions = dbChannels
        .filter(c => c.type === 'direct')
        .map(c => c.name)
        .filter(name => name.toLowerCase().includes(query.toLowerCase()))
      
      setMentionSuggestions(suggestions)
      setFocusedMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  const handleMentionKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedMentionIndex(prev => (prev + 1) % mentionSuggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        applyMentionToken(mentionSuggestions[focusedMentionIndex])
      } else if (e.key === 'Escape') {
        setMentionQuery(null)
      }
    }
  }

  const applyMentionToken = (name: string) => {
    const idx = newMessage.lastIndexOf('@')
    if (idx !== -1) {
      const pre = newMessage.substring(0, idx)
      setNewMessage(`${pre}@${name} `)
      setMentionQuery(null)
      // Throw mock toast alert representing company dispatch override
      displayToast(`🔔 Mention Alert: @${name} tagged in chat message!`)
    }
  }

  // Voice recording simulation loop
  const triggerVoiceRecording = () => {
    if (isRecording) {
      // STOP recording
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
      setIsRecording(false)
      
      // Simulate automatic high fidelity transcription from MaintainX AI scribe
      const transcribePhrases = [
        "Technician Lucas reports: Boiler heater thermal sensor indicates steady heat values but pressure dial requires alignment.",
        "Emergency team attention: Main power supply breaker has tripped again in Section B. Please dispatch electricians.",
        "HVAC system air flow looks normal but high wear notice noted on water cooling duct valves.",
        "Safety check complete: Fire exit clear of debris, work site properly cordoned off."
      ]
      const randomTranscription = transcribePhrases[Math.floor(Math.random() * transcribePhrases.length)]
      setAudioBlobTranscribed(randomTranscription)
      displayToast("🤖 AI Scribe Done: Transcribed voice note")
    } else {
      // START recording
      setAudioBlobTranscribed(null)
      setRecordTimer(0)
      setIsRecording(true)
      recordingIntervalRef.current = setInterval(() => {
        setRecordTimer(prev => prev + 1)
      }, 1000)
    }
  }

  // Clear interval if unmounts
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
    }
  }, [])

  // Side-Thread comment submission
  const submitThreadComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!threadParent || !newThreadText.trim() || !currentUser) return

    const newReply: ThreadReply = {
      id: `reply_${Date.now()}`,
      content: newThreadText.trim(),
      senderId: currentUser.userId || currentUser.id,
      senderName: currentUser.name || currentUser.userId || 'User',
      senderRole: currentUser.role || 'USER',
      createdAt: new Date().toISOString()
    }

    const key = `maintainx_thread_replies_${threadParent.id}`
    const previous = JSON.parse(localStorage.getItem(key) || '[]')
    const updated = [...previous, newReply]
    localStorage.setItem(key, JSON.stringify(updated))

    setThreadReplies(updated)
    setNewThreadText('')
    
    // Auto incremental animation
    setTimeout(() => {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)

    // Notify user
    displayToast("💬 Side-thread comment posted!")
  }

  // Get total replies for a specific message
  const getThreadRepliesCount = (msgId: string) => {
    try {
      const items = JSON.parse(localStorage.getItem(`maintainx_thread_replies_${msgId}`) || '[]')
      return items.length
    } catch {
      return 0
    }
  }

  // Client Msg Edits & Deletion handling
  const setLocalMessageContent = (id: string, newTxt: string) => {
    const edits_key = 'maintainx_msg_local_edits'
    const curEdits = JSON.parse(localStorage.getItem(edits_key) || '{}')
    curEdits[id] = newTxt
    localStorage.setItem(edits_key, JSON.stringify(curEdits))
    
    setEditingMsgId(null)
    setEditingMsgContent('')
    fetchMessagesRef.current()
    displayToast("✏️ Message updated successfully!")
  }

  const deleteLocalMessage = (id: string) => {
    const del_key = 'maintainx_msg_local_deletes'
    const curDeletes = JSON.parse(localStorage.getItem(del_key) || '[]')
    if (!curDeletes.includes(id)) {
      curDeletes.push(id)
      localStorage.setItem(del_key, JSON.stringify(curDeletes))
    }
    fetchMessagesRef.current()
    displayToast("🗑️ Message deleted")
  }

  // Copy Message jump link
  const copyMessageJumpLink = (msg: ChatMessage) => {
    const lnk = `${window.location.origin}/messages?channel=${activeChannel?.id}&msgId=${msg.id}`
    navigator.clipboard.writeText(lnk)
    displayToast("🔗 Message link copied to clipboard!")
  }

  // Converts specific Chat Message to functional Work Order
  const startWorkOrderConversion = (msg: ChatMessage) => {
    setConvertingMessage(msg)
    // Clean message prefix details
    let cleanText = msg.content
    if (msg.content.startsWith('🎤 [Voice Clip:')) {
      cleanText = msg.content.substring(16, msg.content.length - 1)
    }
    setWoTitle(`Fix Request: ${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}`)
    prepareSystemFormOptions()
    setShowWorkOrderModal(true)
  }

  const executeWorkOrderCreation = async () => {
    if (!woTitle.trim() || !currentUser || !convertingMessage) return
    setIsConvertingWO(true)

    try {
      const payload = {
        title: woTitle.trim(),
        description: `Generated from system chat center. Original transmission from user "${convertingMessage.senderName}" (${convertingMessage.senderRole}):\n\n"${convertingMessage.content}"`,
        type: woType,
        priority: woPriority,
        status: 'OPEN',
        assetId: selectedAssetId || null,
        locationId: selectedLocationId || null,
        assignedToId: selectedAssigneeId || null,
        locationScope: 'GENERAL',
        selectedAssetIds: selectedAssetId ? [selectedAssetId] : [],
      }

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const createdWO = await res.json()
        displayToast(`🛠️ Created Work Order ${createdWO.woNumber} successfully!`)
        
        // Save trace in chat feed
        const key = `maintainx_messages_group_${convertingMessage.channel}`
        const updatedMsg: ChatMessage = {
          id: `sys_wo_${Date.now()}`,
          content: `🛠️ [System Dispatch Log] Message was converted to Work Order ${createdWO.woNumber}: "${createdWO.title}" by ${currentUser.name || currentUser.userId || 'User'}.`,
          channel: convertingMessage.channel,
          channelName: convertingMessage.channelName,
          senderId: 'system',
          senderName: 'System Dispatcher',
          senderRole: 'ADMIN',
          createdAt: new Date().toISOString(),
          convertedWOId: createdWO.id,
          convertedWONumber: createdWO.woNumber
        }

        if (convertingMessage.channel.startsWith('GROUP_')) {
          const cur = JSON.parse(localStorage.getItem(key) || '[]')
          localStorage.setItem(key, JSON.stringify([...cur, updatedMsg]))
        } else {
          // Send system dispatch logged as standard DB message if we have permission
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🛠️ [System Dispatch Log] This conversion created Work Order ${createdWO.woNumber}.`,
              channel: convertingMessage.channel,
              channelName: convertingMessage.channelName,
            })
          })
        }

        setShowWorkOrderModal(false)
        setConvertingMessage(null)
        await fetchMessagesRef.current()
      } else {
        const err = await res.json()
        alert(`Failed creating Work Order: ${err.error || 'Server error'}`)
      }
    } catch (e) {
      console.error(e)
      alert("Network discrepancy during Work Order dispatch.")
    } finally {
      setIsConvertingWO(false)
    }
  }

  // Filters results
  const filteredChannelsRendered = allChannelsCombined.filter(channel => {
    // Exclude hidden
    if (hiddenIds.includes(channel.id)) return false

    const matchesSearch =
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (activeTab === 'all') return true
    return channel.type === activeTab
  })

  // Separate pinned vs standard
  const pinnedChannels = filteredChannelsRendered.filter(c => pinnedIds.includes(c.id))
  const regularChannels = filteredChannelsRendered.filter(c => !pinnedIds.includes(c.id))

  // Role custom styling
  const roleStyles: Record<string, string> = {
    ADMIN: 'bg-rose-100 text-rose-700 font-bold border border-rose-200',
    MANAGER: 'bg-blue-100 text-blue-700 font-bold border border-blue-200',
    TECHNICIAN: 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200',
  }

  // Helper function to evaluate and render sidebar room items
  const renderChannelRow = (channel: ChatChannel) => {
    const isActive = activeChannel?.id === channel.id
    const isPinned = pinnedIds.includes(channel.id)
    const isMuted = mutedIds.includes(channel.id)
    const isUnread = unreadIds.includes(channel.id)
    const isMenuOpen = menuOpenChanId === channel.id

    return (
      <div
        key={channel.id}
        className={`group/item relative w-full text-left transition-all hover:bg-slate-50/70 border-l-4 cursor-pointer outline-none ${
          isActive 
            ? 'bg-blue-50/45 border-blue-600 pl-0' 
            : isUnread 
              ? 'bg-slate-50/80 border-cyan-500 pl-0' 
              : 'border-transparent pl-0'
        }`}
      >
        <div className="flex gap-3 p-3 items-center" onClick={() => setActiveChannel(channel)}>
          {/* Channel Avatar bubble */}
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-base shadow-3xs flex-shrink-0 border border-slate-200/40 select-none relative">
            {channel.avatarText}
            {isUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 border-2 border-white rounded-full" />
            )}
          </div>

          {/* Information body */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <p className={`text-xs font-bold truncate leading-tight ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                {channel.name}
              </p>
              
              {/* Indicators line */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isMuted && <VolumeX className="w-3 h-3 text-slate-400" />}
                {isPinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 rotate-45" />}
                
                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-md tracking-wider border ${
                  channel.type === 'general' ? 'bg-indigo-50 text-indigo-600 border-indigo-150' :
                  channel.type === 'team' ? 'bg-teal-50 text-teal-600 border-teal-150' :
                  channel.type === 'workorder' ? 'bg-amber-50 text-amber-600 border-amber-150' :
                  channel.type === 'group' ? 'bg-purple-50 text-purple-600 border-purple-150' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {channel.type === 'workorder' ? 'WO' : channel.type}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {channel.description}
            </p>
          </div>
        </div>

        {/* Float Trigger menu drawer button */}
        <div className="absolute right-2 top-3 opacity-0 group-hover/item:opacity-100 transition-opacity z-10 flex gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpenChanId(isMenuOpen ? null : channel.id)
            }}
            className="p-1 hover:bg-slate-205 rounded-md text-slate-500 bg-white shadow-xs border border-slate-200/50 cursor-pointer"
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inline floating context menu values */}
        {isMenuOpen && (
          <div 
            className="absolute right-2 top-10 bg-white border border-slate-200 rounded-xl shadow-md p-1.5 z-40 w-44 font-sans text-xs space-y-0.5"
            onMouseLeave={() => setMenuOpenChanId(null)}
          >
            <button
              onClick={() => togglePinChannel(channel.id)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer transition-colors font-semibold"
            >
              <Pin className="w-3.5 h-3.5 text-slate-400" />
              {isPinned ? 'Unpin Room' : 'Pin to Top'}
            </button>

            <button
              onClick={() => toggleMuteChannel(channel.id)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer transition-colors font-semibold"
            >
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              {isMuted ? 'Mute Alerts' : 'Mute room'}
            </button>

            <button
              onClick={() => markChannelAsUnread(channel.id)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2 cursor-pointer transition-colors font-semibold"
            >
              <Bookmark className="w-3.5 h-3.5 text-slate-400" />
              Mark as Unread
            </button>

            <div className="border-t border-slate-100 my-1" />

            <button
              onClick={() => hideChannelItem(channel.id)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer transition-colors font-semibold"
            >
              <EyeOff className="w-3.5 h-3.5 text-rose-400" />
              Hide (Archive)
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div id="messages-component-root" className="relative flex flex-col md:flex-row h-[calc(100vh-120px)] lg:h-[calc(100vh-70px)] bg-slate-150 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      
      {/* ────────────────── 1. SIDEBAR COMMUNICATIONS PANEL ────────────────── */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0 ${activeChannel ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-55/40 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600 block">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-base font-bold text-slate-800 tracking-tight font-sans">Comms Hub</h1>
                <p className="text-[10px] text-slate-400 font-medium">MaintainX Team Workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Reset/Manage archived trigger settings */}
              <button
                onClick={() => setShowHiddenManager(true)}
                title="Manage hidden channels"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-550 transition-colors cursor-pointer"
              >
                <EyeOff className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={() => setShowCreateGroup(true)}
                title="Assemble custom group chat"
                className="p-1.5 hover:bg-blue-50 bg-blue-600/5 text-blue-600 rounded-lg transition-all scale-100 active:scale-95 cursor-pointer font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden lg:inline font-bold">Group</span>
              </button>

              <button 
                onClick={() => fetchMessagesRef.current()} 
                title="Refresh messages list"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-transform active:rotate-180 duration-500 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rooms, coworkers or issues..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 hover:bg-slate-150/60 focus:bg-white rounded-xl border border-slate-200 focus:border-slate-350 outline-none text-slate-700 placeholder-slate-450 transition-all font-semibold"
            />
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'general', label: '📢 General' },
              { id: 'team', label: '🛠️ Teams' },
              { id: 'workorder', label: '📋 WOs' },
              { id: 'direct', label: '👤 Direct' },
              { id: 'group', label: '👥 Groups' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 text-[10px] sm:text-[10px] font-bold rounded-lg whitespace-nowrap transition-all border select-none cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Channels scroll container */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          
          {loadingChannels ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="font-medium">Retrieving workspace networks...</span>
            </div>
          ) : filteredChannelsRendered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1">
              <span className="text-2xl">💤</span>
              <p className="font-bold text-slate-500">No rooms available</p>
              <p className="text-[10px] max-w-xs text-slate-400 mt-0.5">Change filters or select gear icon to verify hidden elements.</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              
              {/* 📌 Display PINNED Channels section */}
              {pinnedChannels.length > 0 && (
                <div>
                  <div className="px-4 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Pin className="w-3 h-3 text-amber-500 fill-amber-500" /> Locked & Pinned
                  </div>
                  <div className="divide-y divide-slate-50">
                    {pinnedChannels.map(channel => renderChannelRow(channel))}
                  </div>
                </div>
              )}

              {/* Display standard Channels section */}
              <div>
                {pinnedChannels.length > 0 && (
                  <div className="px-4 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Direct Conversations / Groups
                  </div>
                )}
                <div className="divide-y divide-slate-50">
                  {regularChannels.map(channel => renderChannelRow(channel))}
                </div>
              </div>

            </div>
          )}
        </div>
        
        {/* Foot lock user details */}
        {currentUser && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase border border-blue-200">
              {(currentUser.name || currentUser.userId || 'US').substring(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-800 truncate leading-snug">{currentUser.name || currentUser.userId || 'User'}</p>
              <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded-xs uppercase">
                {(currentUser.role || 'USER')} Account
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────── 2. CENTRAL ACTIVE DIALOG STREAM FEED ────────────────── */}
      <div className={`flex-1 bg-slate-50 flex flex-col h-full ${!activeChannel ? 'hidden md:flex' : 'flex'}`}>
        {activeChannel ? (
          <>
            {/* Active Channel locked header info */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-3xs flex-shrink-0 z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Back button for responsive view mobile */}
                <button
                  type="button"
                  onClick={() => setActiveChannel(null)}
                  className="md:hidden p-1.5 hover:bg-slate-100 rounded-xl text-slate-550 mr-1 cursor-pointer"
                  title="Back to conversations list"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>

                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-base border border-slate-200/50 shadow-3xs flex-shrink-0">
                  {activeChannel.avatarText}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-800 truncate tracking-tight">{activeChannel.name}</h2>
                    {mutedIds.includes(activeChannel.id) && (
                      <span className="p-0.5 rounded-sm bg-slate-100 text-slate-400" title="Mute Active"><VolumeX className="w-3 h-3" /></span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{activeChannel.description}</p>
                </div>
              </div>

              {/* Right Special Action context bar */}
              <div className="flex items-center gap-2">
                {activeChannel.type === 'workorder' && (
                  <button
                    onClick={() => router.push(`/work-orders/${activeChannel.id.substring(3)}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Repair Ticket</span>
                  </button>
                )}

                {/* Secure locked channel assurance indicator */}
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-extrabold bg-slate-100 text-slate-600 rounded-lg select-none border border-slate-200/50">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> Security Locked
                </span>
              </div>
            </div>

            {/* Locked Company isolation announcement banner */}
            <div className="bg-slate-100 border-b border-slate-200/50 px-6 py-2 flex items-center justify-between text-[10px] font-bold text-slate-500 flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                <span>Isolated Domain: Only verified invited members can view messages posted inside.</span>
              </span>
              <span className="text-[9px] uppercase text-slate-400 tracking-wider">AES-256 Rules Active</span>
            </div>

            {/* Stream Flow List Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-linear-to-b from-slate-50 to-slate-100/50 relative">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="font-semibold">Decrypting secure dialogue logs...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-sm mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200/60 flex items-center justify-center mb-4 text-2xl shadow-3xs transition-transform hover:scale-105 select-none">💬</div>
                  <h3 className="text-xs font-bold text-slate-800">Secure Conversation Unopened</h3>
                  <p className="text-[10px] text-slate-400 max-w-xs mt-1.5 leading-relaxed">
                    Be the first to secure team collaboration! Type below to coordinate with crews, convert feedback to active Work Orders, or start threads.
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = currentUser && (msg.senderId === (currentUser.userId || currentUser.id))
                  const repliesCount = getThreadRepliesCount(msg.id)
                  const isEditingThis = editingMsgId === msg.id

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`group/msg flex flex-col relative ${isOwn ? 'items-end' : 'items-start'} ${
                        highlightedMsgId === msg.id ? 'animate-pulse bg-amber-50/70 p-3 rounded-xl border border-amber-200 duration-1000' : ''
                      }`}
                    >
                      {/* Sender details indicator above bubble */}
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-500 selection:bg-slate-200">
                        <span>{isOwn ? 'You (Frontline)' : msg.senderName}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-md ${roleStyles[msg.senderRole] || 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                          {msg.senderRole}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-401 font-semibold">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        {msg.isEdited && <span className="text-amber-600 font-extrabold bg-amber-50 text-[8px] px-1 rounded-sm border border-amber-100/60 uppercase">Edited</span>}
                      </div>

                      {/* Bubble wrapping content */}
                      <div className="relative max-w-md md:max-w-xl group">
                        
                        {/* Inline editor component */}
                        {isEditingThis ? (
                          <div className="bg-white border border-slate-300 shadow-sm p-2 rounded-xl flex flex-col gap-2 min-w-[280px]">
                            <textarea
                              rows={2}
                              value={editingMsgContent}
                              onChange={e => setEditingMsgContent(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none font-semibold focus:border-blue-500 font-sans"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingMsgId(null)}
                                className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => setLocalMessageContent(msg.id, editingMsgContent)}
                                className="px-2.5 py-1 text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md cursor-pointer transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-semibold transition-all relative ${
                              isOwn
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-xs text-white selection:bg-blue-500'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-3xs'
                            }`}
                          >
                            {/* Converted WO System Announcement card */}
                            {msg.convertedWOId && (
                              <div className="mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5 text-slate-800 text-[10px]">
                                <div className="flex items-center gap-1 font-extrabold text-blue-700">
                                  <FileCheck className="w-3.5 h-3.5" />
                                  <span>DISPATCH TICKET GENERATED</span>
                                </div>
                                <p className="font-bold">Work Order {msg.convertedWONumber} created and dispatched to active schedules.</p>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/work-orders/${msg.convertedWOId}`)}
                                  className="self-start px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-extrabold rounded-lg text-[9px] inline-flex items-center gap-1 transition-all"
                                >
                                  View Work Order {msg.convertedWONumber} →
                                </button>
                              </div>
                            )}

                            {/* Voice Message waveform mock render */}
                            {msg.isVoice ? (
                              <div className="space-y-1.5 my-1">
                                <div className="flex items-center gap-2 bg-black/5 p-2 rounded-xl border border-black/10">
                                  <button type="button" className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center cursor-pointer transition-colors">
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                  <div className="flex items-end gap-0.5 h-5 px-1 flex-1">
                                    <span className="w-0.75 h-2 bg-blue-500/80 rounded-sm animate-pulse" />
                                    <span className="w-0.75 h-4 bg-blue-400 rounded-sm" />
                                    <span className="w-0.75 h-3 bg-blue-500 rounded-sm animate-pulse" />
                                    <span className="w-0.75 h-5 bg-blue-600 rounded-sm" />
                                    <span className="w-0.75 h-2 bg-blue-400 rounded-sm" />
                                    <span className="w-0.75 h-3 bg-blue-300 rounded-sm" />
                                    <span className="w-0.75 h-4 bg-blue-500 rounded-sm animate-pulse" />
                                    <span className="w-0.75 h-2 bg-blue-600/75 rounded-sm" />
                                  </div>
                                  <span className="text-[10px] font-bold block opacity-85 font-mono">{msg.voiceDuration || '0:04'}</span>
                                </div>
                                <p className="italic font-bold font-sans text-[10px] opacity-90 border-l-2 border-slate-400/40 pl-2 bg-black/2.5 py-1 rounded-r-lg">
                                  🤖 Transcribed: {msg.content.replace('🎤 [Voice Clip: ', '').replace(']', '')}
                                </p>
                              </div>
                            ) : (
                              // Regular text parser with tagged links highlight
                              <p className="whitespace-pre-wrap">
                                {msg.content.split(' ').map((word, wIdx) => {
                                  if (word.startsWith('@')) {
                                    return (
                                      <span key={wIdx} className="bg-blue-200/45 dark:bg-black/15 text-blue-800 dark:text-blue-100 px-1 py-0.2 rounded-xs border border-blue-300/30 font-extrabold mr-1">
                                        {word}
                                      </span>
                                    )
                                  }
                                  return word + ' '
                                })}
                              </p>
                            )}

                            {/* Media image card block */}
                            {msg.mediaUrl && (
                              <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-3xs max-w-sm">
                                <img
                                  src={msg.mediaUrl}
                                  alt={msg.mediaName || 'Media'}
                                  className="w-full h-32 object-cover"
                                />
                                <div className="p-2 bg-white border-t border-slate-100 text-[9px] font-bold text-slate-500 flex items-center gap-1.5">
                                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate">{msg.mediaName || 'Attached attachment'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Power operations control bar on Hover */}
                        {!msg.isDeleted && !isEditingThis && (
                          <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 flex items-center gap-0.5 pointer-events-none group-hover:pointer-events-auto ${
                            isOwn ? 'right-full mr-2' : 'left-full ml-2'
                          }`}>
                            <div className="flex bg-white shadow-md rounded-lg border border-slate-200 p-1 divide-x divide-slate-100 text-slate-500">
                              
                              <button
                                onClick={() => startWorkOrderConversion(msg)}
                                className="px-2 py-1 text-[10px] font-bold hover:bg-slate-100 hover:text-blue-600 flex items-center gap-1.5 text-slate-600 cursor-pointer transition-colors"
                                title="Convert this text to Work Order Repair Ticket"
                              >
                                <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                                <span className="hidden lg:inline font-bold">Ticket</span>
                              </button>

                              <button
                                onClick={() => setThreadParent(msg)}
                                className="px-2 py-1 text-[10px] font-bold hover:bg-slate-100 hover:text-purple-600 flex items-center gap-1.5 text-slate-600 cursor-pointer transition-colors"
                                title="Reply in isolated Thread discussion side panel"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-purple-500" />
                                <span className="hidden lg:inline font-bold">Reply</span>
                              </button>

                              <button
                                onClick={() => copyMessageJumpLink(msg)}
                                className="p-1 hover:bg-slate-100 rounded-md text-slate-550 cursor-pointer"
                                title="Copy secure message jump link"
                              >
                                <Link2 className="w-3.5 h-3.5 text-slate-400" />
                              </button>

                              {isOwn && (
                                <div className="flex pl-1">
                                  <button
                                    onClick={() => {
                                      setEditingMsgId(msg.id)
                                      setEditingMsgContent(msg.content)
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded-md text-amber-600 cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteLocalMessage(msg.id)}
                                    className="p-1 hover:bg-rose-50 rounded-md text-rose-650 cursor-pointer"
                                    title="Delete Message"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Display replies side label wrapper */}
                      {repliesCount > 0 && (
                        <button
                          onClick={() => setThreadParent(msg)}
                          className={`mt-1.5 text-[10px] font-extrabold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer select-none bg-blue-50 border border-blue-150 px-2.5 py-0.8 rounded-xl ${
                            isOwn ? 'self-end' : 'self-start'
                          }`}
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                          <span>{repliesCount} Thread Replies • View thread</span>
                        </button>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Micro-Panel attachment files preview banner before active form submission */}
            {(selectedMediaPreset || audioBlobTranscribed) && (
              <div className="p-3 bg-amber-50 border-t border-amber-200/60 flex items-center justify-between flex-shrink-0 animate-fade-in">
                <div className="flex items-center gap-2 text-[10px] font-bold text-amber-800">
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-300" />
                  {selectedMediaPreset ? (
                    <span className="flex items-center gap-1">
                      Paperclip Preset Attachment: <strong className="underline">{selectedMediaPreset.name}</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      AI Scribe Speech transcribing verified: <strong>{audioBlobTranscribed?.substring(0, 50)}...</strong>
                    </span>
                  )}
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMediaPreset(null)
                      setAudioBlobTranscribed(null)
                    }}
                    className="p-1 hover:bg-amber-100 rounded text-amber-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Message input panel form */}
            <div className="bg-white border-t border-slate-200 relative p-4 flex-shrink-0">
              
              {/* @Mentions suggests autocomplete dropdown drawer */}
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <div
                  ref={mentionDropdownRef}
                  className="absolute bottom-full left-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 w-72 max-h-48 overflow-y-auto p-1 text-xs"
                >
                  <p className="px-3 py-1 bg-slate-50 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Tag workspace coworker</p>
                  {mentionSuggestions.map((name, mIdx) => (
                    <button
                      key={name}
                      onClick={() => applyMentionToken(name)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer font-semibold ${
                        mIdx === focusedMentionIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span>@{name}</span>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">TECHNICIAN</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Media preset drawer */}
              {showMediaPresets && (
                <div className="absolute bottom-full left-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-80">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Attach Industrial Screenshot</span>
                    <button onClick={() => setShowMediaPresets(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {industrialMediaPresets.map(p => (
                      <button
                        key={p.name}
                        onClick={() => {
                          setSelectedMediaPreset(p)
                          setAudioBlobTranscribed(null)
                          setShowMediaPresets(false)
                        }}
                        className="p-1 border border-slate-100 hover:border-blue-500 rounded-lg text-left overflow-hidden bg-slate-50 transition-colors cursor-pointer block"
                      >
                        <img src={p.url} className="w-full h-14 object-cover rounded-md mb-1" />
                        <span className="text-[9px] font-bold text-slate-600 truncate block">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={triggerSendMessage}
                className="flex gap-2 items-center"
              >
                {/* Media paperclip button */}
                <button
                  type="button"
                  onClick={() => setShowMediaPresets(!showMediaPresets)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 cursor-pointer active:scale-95 transition-transform"
                  title="Attach screenshot photo illustration"
                >
                  <Paperclip className="w-4 h-4 text-slate-600" />
                </button>

                {/* Microphone recording mock button */}
                <button
                  type="button"
                  onClick={triggerVoiceRecording}
                  className={`p-2 rounded-xl active:scale-95 transition-all text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer relative ${
                    isRecording ? 'bg-rose-100 text-rose-600 hover:bg-rose-150 animate-pulse' : 'bg-slate-100'
                  }`}
                  title="Turn on microphone to record dictation speech transcript"
                >
                  <Mic className="w-4 h-4" />
                  {isRecording && (
                    <span className="absolute -top-1 -right-1 px-1 py-0.2 text-[7px] font-extrabold text-white bg-rose-600 rounded-full">
                      {recordTimer}s
                    </span>
                  )}
                </button>

                {/* Styled text-input */}
                <input
                  type="text"
                  placeholder={isRecording ? `🔴 Listening... speak into microphone. Tap Mic to transcribe.` : `Message ${activeChannel.name}... Type @ to tag coworkers.`}
                  value={newMessage}
                  onChange={e => {
                    setNewMessage(e.target.value)
                    triggerMentionAlert(e.target.value)
                  }}
                  onKeyDown={handleMentionKeydown}
                  disabled={isSending || isRecording}
                  className="flex-1 px-4 py-2.5 text-xs bg-slate-100 hover:bg-slate-150/65 focus:bg-white rounded-xl border border-slate-250 focus:border-blue-500 outline-none placeholder-slate-400 transition-all font-semibold"
                />

                {/* Send action arrow */}
                <button
                  type="submit"
                  disabled={isSending || isRecording || (!newMessage.trim() && !selectedMediaPreset)}
                  className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-8">
            <MessageCircle className="w-14 h-14 mb-3 text-slate-300" />
            <h2 className="text-xs font-bold text-slate-700">No active channel selected</h2>
            <p className="text-[10px] text-slate-403 max-w-xs mt-1">Select from Pinned list or system workspace to coordinate repairs and message colleagues.</p>
          </div>
        )}
      </div>

      {/* ────────────────── 3. THREAD CONVERSATION SIDE BAR (4th column) ────────────────── */}
      {threadParent && (
        <div className="w-full md:w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full z-20 absolute md:static right-0 top-0 shadow-lg md:shadow-none animate-slide-in flex-shrink-0">
          
          {/* Thread Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded bg-purple-50 text-purple-600"><MessageCircle className="w-4 h-4" /></span>
              <div>
                <h3 className="text-xs font-bold text-slate-800">Thread Discussion</h3>
                <p className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold">Isolated Thread Session</p>
              </div>
            </div>
            <button
              onClick={() => setThreadParent(null)}
              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Root Message Box */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-100/80">
            <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-400 uppercase mb-1">
              <span>{threadParent.senderName}</span>
              <span>•</span>
              <span className="bg-slate-100 text-slate-500 px-1 py-0.1 rounded">{threadParent.senderRole}</span>
            </div>
            <p className="text-[11px] text-slate-705 font-bold leading-relaxed whitespace-pre-wrap">{threadParent.content}</p>
          </div>

          {/* Replies feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-linear-to-b from-slate-50 to-white">
            {threadReplies.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 text-[10px] gap-1">
                <span>💬</span>
                <p className="font-bold">No threaded replies yet</p>
                <p className="text-[9px]">Keep communication clear. Type below to respond in thread.</p>
              </div>
            ) : (
              threadReplies.map(rep => (
                <div key={rep.id} className="p-2.5 rounded-xl border border-slate-100 bg-white shadow-3xs space-y-1">
                  <div className="flex items-center justify-between text-[8px] font-extrabold text-slate-400 tracking-wide">
                    <span className="text-slate-600">{rep.senderName} ({rep.senderRole})</span>
                    <span>
                      {new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-700 font-medium leading-normal whitespace-pre-wrap">{rep.content}</p>
                </div>
              ))
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Reply form */}
          <form
            onSubmit={submitThreadComment}
            className="p-3 border-t border-slate-150 bg-slate-50 flex gap-1.5"
          >
            <input
              type="text"
              placeholder="Reply inside thread..."
              value={newThreadText}
              onChange={e => setNewThreadText(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:border-purple-500 outline-none font-semibold text-slate-700"
            />
            <button
              type="submit"
              disabled={!newThreadText.trim()}
              className="p-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-lg text-white select-none shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ────────────────── 4. CONVERT TO WORK ORDER POPUP MODAL ────────────────── */}
      {showWorkOrderModal && convertingMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-slate-200 animate-scale-up text-xs space-y-4 text-slate-800 font-sans">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ClipboardList className="w-5 h-5 animate-pulse" /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Create MaintainX Work Order</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Extracting repair request details from frontline chat logs</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowWorkOrderModal(false)
                  setConvertingMessage(null)
                }} 
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Original message reference transcript card */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150/80">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase mb-1">Source Message Transcript:</p>
              <p className="text-[10px] italic font-bold text-slate-655 font-sans leading-relaxed">
                "{convertingMessage.content}"
              </p>
              <p className="text-[8px] text-slate-400 font-extrabold mt-1.5">Captured from: {convertingMessage.senderName} ({convertingMessage.senderRole}) • {new Date(convertingMessage.createdAt).toLocaleString()}</p>
            </div>

            {/* Form Fields container */}
            <div className="space-y-3.5">
              
              {/* WO Title field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title (Max 100 characters)</label>
                <input
                  type="text"
                  value={woTitle}
                  onChange={e => setWoTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  placeholder="Summarize the repair task..."
                />
              </div>

              {/* Priority & Type buttons row */}
              <div className="grid grid-cols-2 gap-35">
                
                {/* Priority Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Priority Target</label>
                  <div className="grid grid-cols-4 gap-1 border border-slate-200/80 rounded-xl p-0.5">
                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setWoPriority(p)}
                        className={`py-1 rounded text-[9px] font-extrabold cursor-pointer text-center select-none ${
                          woPriority === p
                            ? p === 'CRITICAL' ? 'bg-rose-600 text-white shadow-xs' : p === 'HIGH' ? 'bg-orange-500 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-500'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repair Task Type Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Schedule Type</label>
                  <div className="grid grid-cols-3 gap-1 border border-slate-200/80 rounded-xl p-0.5">
                    {(['BREAKDOWN', 'PREVENTIVE', 'PREDICTIVE'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setWoType(t)}
                        className={`py-1 rounded text-[9px] font-extrabold cursor-pointer text-center ${
                          woType === t
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-500'
                        }`}
                      >
                        {t === 'BREAKDOWN' ? 'CORR' : t === 'PREVENTIVE' ? 'PREV' : 'PRED'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Directory mappings */}
              <div className="grid grid-cols-3 gap-3">
                
                {/* 1. Assets list dropdown selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Link Asset (optional)</label>
                  <select
                    value={selectedAssetId}
                    onChange={e => setSelectedAssetId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl outline-none font-bold bg-white"
                  >
                    <option value="">-- None --</option>
                    {systemAssets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.assetCode || 'No Code'})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Locations mapped */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Location</label>
                  <select
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl outline-none font-bold bg-white"
                  >
                    <option value="">-- None / General --</option>
                    {systemLocations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Technicians mapped */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assign Repair Tech</label>
                  <select
                    value={selectedAssigneeId}
                    onChange={e => setSelectedAssigneeId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl outline-none font-bold bg-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {systemUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

              </div>

            </div>

            {/* Modal foot actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
              <button
                onClick={() => {
                  setShowWorkOrderModal(false)
                  setConvertingMessage(null)
                }}
                disabled={isConvertingWO}
                className="px-4 py-2 font-bold bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeWorkOrderCreation}
                disabled={isConvertingWO || !woTitle.trim()}
                className="px-4 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isConvertingWO ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Generate & Dispatch WO</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────── 5. ASSEMBLE CREW GROUP CHAT POPUP MODAL ────────────────── */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-250/80 animate-scale-up text-xs space-y-4 inline-block font-sans text-slate-800">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Users className="w-5 h-5 animate-pulse" /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Assemble Multi-Person Crew Chat</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Create a custom temporary group chat room for specific tasks</p>
                </div>
              </div>
              <button onClick={() => setShowCreateGroup(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Group Action Title</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift Mechanical, Boiler Team B"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-purple-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Objectives Description</label>
                <input
                  type="text"
                  placeholder="Task coordinates, safety objectives or equipment reference..."
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-purple-500 outline-none font-bold"
                />
              </div>

              {/* Members Checklist */}
              <div>
                <legend className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Crewmates to Invite</legend>
                <div className="border border-slate-250/70 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto bg-slate-50 p-1">
                  {dbChannels
                    .filter(c => c.type === 'direct')
                    .map(channel => {
                      const otherId = channel.id.substring(7).split('_').find(x => x !== currentUser?.userId)
                      if (!otherId) return null
                      const isChecked = selectedGroupMembers.includes(otherId)

                      return (
                        <label
                          key={otherId}
                          className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{channel.avatarText}</span>
                            <span className="font-bold text-slate-700">{channel.name}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedGroupMembers(prev =>
                                isChecked ? prev.filter(x => x !== otherId) : [...prev, otherId]
                              )
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                          />
                        </label>
                      )
                    })}
                </div>
              </div>

            </div>

            {/* Pop action */}
            <div className="flex justify-end gap-2 border-t border-slate-150 pt-4 mt-2 bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="px-4 py-2 font-bold bg-slate-100 hover:bg-slate-200 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={createCustomGroupChat}
                disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                className="px-4 py-2 font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-xl text-white shadow-md cursor-pointer transition-all"
              >
                Assemble Crew
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────── 6. HIDDEN / ARCHIVED CHATS MANAGER MODAL ────────────────── */}
      {showHiddenManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 animate-scale-up text-xs space-y-4 font-sans text-slate-800">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><EyeOff className="w-5 h-5" /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Restore Archived / Hidden Rooms</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Verify your silenced channels and click Eye icon to restore them to main list</p>
                </div>
              </div>
              <button onClick={() => setShowHiddenManager(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden Channels checklist */}
            <div className="space-y-3">
              {hiddenIds.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  No communication lines are currently hidden or archived.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-150 max-h-56 overflow-y-auto">
                  {allChannelsCombined
                    .filter(c => hiddenIds.includes(c.id))
                    .map(c => (
                      <div key={c.id} className="p-3 hover:bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base select-none">{c.avatarText}</span>
                          <div>
                            <p className="font-bold text-slate-850 leading-tight">{c.name}</p>
                            <p className="text-[9px] text-slate-400 font-medium">{c.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => restoreHiddenChannel(c.id)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-105 font-bold rounded-lg cursor-pointer transition-colors"
                          title="Restore to chat room list"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Modal foot actions */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHiddenManager(false)}
                className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer transition-colors"
              >
                Close Manager
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────── 7. NOTIFICATION OVERLAY TOAST DIALOG ────────────────── */}
      {notificationToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-sm z-50 animate-slide-up select-none">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-sm">
            🔔
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-tight text-white">{notificationToast}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setNotificationToast(null)} 
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  )
}
