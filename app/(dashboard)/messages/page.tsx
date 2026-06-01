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
} from 'lucide-react'

interface ChatChannel {
  id: string
  name: string
  type: 'general' | 'team' | 'workorder' | 'direct'
  description: string
  avatarText: string
}

interface ChatMessage {
  id: string
  content: string
  channel: string
  channelName: string
  senderId: string
  senderName: string
  senderRole: string
  createdAt: string
}

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'team' | 'workorder' | 'direct'>('all')
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Fetch current user on mount
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
        console.error('Failed to parse active user session:', err)
      }
    }
    loadCurrentUser()
  }, [router])

  // Fetch Channels on mount
  useEffect(() => {
    async function loadChannels() {
      try {
        setLoadingChannels(true)
        const res = await fetch('/api/messages?list_channels=true')
        if (res.ok) {
          const data = await res.json()
          setChannels(data)
          // Set General as default channel
          const generalChan = data.find((c: any) => c.id === 'GENERAL')
          if (generalChan) {
            setActiveChannel(generalChan)
          } else if (data.length > 0) {
            setActiveChannel(data[0])
          }
        }
      } catch (err) {
        console.error('Failed to fetch channels:', err)
      } finally {
        setLoadingChannels(false)
      }
    }
    loadChannels()
  }, [])

  // Fetch Messages for Selected Channel
  const fetchMessagesRef = useRef<() => Promise<void>>(async () => {})

  fetchMessagesRef.current = async () => {
    if (!activeChannel) return
    try {
      const res = await fetch(`/api/messages?channel=${activeChannel.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Failed to refresh messages:', err)
    }
  }

  // Load message on channel switch
  useEffect(() => {
    if (!activeChannel) return
    async function loadMessages() {
      try {
        setLoadingMessages(true)
        await fetchMessagesRef.current()
        // Wait a small timeout to allow layout compilation, then scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } catch (err) {
        console.error('Failed to load messages:', err)
      } finally {
        setLoadingMessages(false)
      }
    }
    loadMessages()
  }, [activeChannel])

  // Polling mechanism (every 3 seconds) for real-time live feeling
  useEffect(() => {
    if (!activeChannel) return
    const interval = setInterval(() => {
      fetchMessagesRef.current()
    }, 3000)
    return () => clearInterval(interval)
  }, [activeChannel])

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle message sending
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !activeChannel || !currentUser) return

    const messageText = newMessage
    setNewMessage('')
    setIsSending(true)

    // Optimistic payload
    const optimisticMessage: ChatMessage = {
      id: `optimistic_${Date.now()}`,
      content: messageText,
      channel: activeChannel.id,
      channelName: activeChannel.name,
      senderId: currentUser.userId || currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      createdAt: new Date().toISOString(),
    }

    // Instantly append to state for lightning responsiveness
    setMessages(prev => [...prev, optimisticMessage])

    try {
      // Determine secondary IDs
      let workOrderId: string | undefined
      let teamId: string | undefined
      let receiverId: string | undefined

      if (activeChannel.type === 'workorder') {
        workOrderId = activeChannel.id.substring(3)
      } else if (activeChannel.type === 'team') {
        teamId = activeChannel.id.substring(5)
      } else if (activeChannel.type === 'direct') {
        // DMs format: DIRECT_smallerId_largerId
        const ids = activeChannel.id.substring(7).split('_')
        const myId = currentUser.userId || currentUser.id
        receiverId = ids.find(id => id !== myId)
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageText,
          channel: activeChannel.id,
          channelName: activeChannel.name,
          workOrderId,
          teamId,
          receiverId,
        }),
      })

      if (!res.ok) {
        console.error('Failed to send message backend api')
        // Rollback optimistic update
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      } else {
        // Re-fetch to synchronize actual backend date & id
        await fetchMessagesRef.current()
      }
    } catch (err) {
      console.error(err)
      // Rollback optimistic update
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
    } finally {
      setIsSending(false)
    }
  }

  // Filter channels based on Search Query and select Tab
  const filteredChannels = channels.filter(channel => {
    const matchesSearch =
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (activeTab === 'all') return true
    return channel.type === activeTab
  })

  // Role style mapping
  const roleStyles: Record<string, string> = {
    ADMIN: 'bg-indigo-100 text-indigo-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    TECHNICIAN: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-130px)] lg:h-[calc(100vh-70px)] bg-slate-100 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
      {/* Channels Panel (Left column) */}
      <div className="w-full lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full">
        {/* Header Search & Title */}
        <div className="p-4 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-800 font-sans tracking-tight">System Message Center</h1>
            <button 
              onClick={() => fetchMessagesRef.current()} 
              title="Refresh messages list"
              className="p-1.5 hover:bg-slate-150 rounded-lg text-slate-500 transition-transform active:rotate-185 duration-300"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chat or teams..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100/85 hover:bg-slate-100 focus:bg-white rounded-xl border border-transparent focus:border-slate-300 outline-none text-slate-700 placeholder-slate-450 transition-all font-semibold"
            />
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {(['all', 'general', 'team', 'workorder', 'direct'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-lg whitespace-nowrap transition-colors border select-none ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab === 'workorder' ? 'WOs' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingChannels ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span>Loading communication rooms...</span>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No matching channels found
            </div>
          ) : (
            filteredChannels.map(channel => {
              const worksAsActive = activeChannel?.id === channel.id
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel)}
                  className={`w-full text-left p-4 transition-all flex gap-3.5 hover:bg-slate-50/70 ${
                    worksAsActive ? 'bg-blue-50/50 border-l-4 border-blue-600 pl-3' : 'pl-4'
                  }`}
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg shadow-3xs flex-shrink-0 border border-slate-200/40">
                    {channel.avatarText}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-xs font-bold truncate ${worksAsActive ? 'text-blue-700' : 'text-slate-800'}`}>
                        {channel.name}
                      </p>
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md ${
                        channel.type === 'general' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                        channel.type === 'team' ? 'bg-teal-50 text-teal-600 border border-teal-100' :
                        channel.type === 'workorder' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {channel.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {channel.description}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Area (Right column) */}
      <div className="flex-1 bg-slate-50 flex flex-col h-full">
        {activeChannel ? (
          <>
            {/* Active Channel Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-3xs flex-shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg border border-slate-200">
                  {activeChannel.avatarText}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-800 truncate font-sans tracking-tight">{activeChannel.name}</h2>
                  <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{activeChannel.description}</p>
                </div>
              </div>

              {/* Special Context Actions (e.g. Work Order Link) */}
              {activeChannel.type === 'workorder' && (
                <button
                  onClick={() => router.push(`/work-orders/${activeChannel.id.substring(3)}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl shadow-3xs transition-all active:scale-[0.98]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Work Order
                </button>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-linear-to-b from-slate-50 to-slate-100/50">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span>Retrieving system chat history...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400 text-xl shadow-3xs">💬</div>
                  <p className="text-xs font-bold text-slate-600">No Messages Yet</p>
                  <p className="text-[10px] text-slate-400 max-w-xs mt-1">Be the first to secure collaboration! Send a text to your coworkers on this channel.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwnMessage = currentUser && (msg.senderId === (currentUser.userId || currentUser.id))
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sub-header labels */}
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-500">
                        <span>{isOwnMessage ? 'You' : msg.senderName}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1 py-0 rounded-xs ${roleStyles[msg.senderRole] || 'bg-slate-100 text-slate-600'}`}>
                          {msg.senderRole}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400 font-medium">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-md px-4 py-2.5 rounded-2xl shadow-3xs text-xs leading-relaxed font-sans ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box footer */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-white border-t border-slate-200 flex gap-2.5 items-center flex-shrink-0"
            >
              <input
                type="text"
                placeholder={`Message ${activeChannel.name}...`}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                disabled={isSending}
                className="flex-1 px-4 py-2.5 text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200/60 focus:border-blue-500 outline-none placeholder-slate-400 transition-all font-semibold"
              />
              <button
                type="submit"
                disabled={isSending || !newMessage.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-all active:scale-[0.98]"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-8">
            <MessageCircle className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Select a room to start talking</p>
            <p className="text-[10px] text-slate-400">Choose from the general system board, team channels, work orders, or direct dialogs.</p>
          </div>
        )}
      </div>
    </div>
  )
}
