'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X, Tags } from 'lucide-react'

interface WOSubSubClass { id: string; name: string }
interface WOSubClass    { id: string; name: string; subSubClasses: WOSubSubClass[] }
interface WOClass       { id: string; name: string; subClasses: WOSubClass[] }

interface Props { initialClasses: WOClass[] }

export default function ClassificationManager({ initialClasses }: Props) {
  const [classes,      setClasses]     = useState<WOClass[]>(initialClasses)
  const [expanded,     setExpanded]    = useState<Record<string, boolean>>({})
  const [expandedSub,  setExpandedSub] = useState<Record<string, boolean>>({})
  const [error,        setError]       = useState('')

  // Editing state: { type, parentId, id, value }
  const [adding,  setAdding]  = useState<{ type: 'class' | 'sub' | 'subsub'; parentId?: string; subParentId?: string } | null>(null)
  const [editing, setEditing] = useState<{ type: 'class' | 'sub' | 'subsub'; id: string; parentId?: string } | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [saving,   setSaving] = useState(false)

  const toggleClass  = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))
  const toggleSub    = (id: string) => setExpandedSub(p => ({ ...p, [id]: !p[id] }))

  async function startAdd(type: 'class' | 'sub' | 'subsub', parentId?: string, subParentId?: string) {
    setAdding({ type, parentId, subParentId }); setInputVal(''); setError('')
  }

  async function commitAdd() {
    if (!inputVal.trim()) return
    setSaving(true); setError('')
    try {
      let url = ''
      if (adding?.type === 'class')  url = '/api/wo-classifications'
      if (adding?.type === 'sub')    url = `/api/wo-classifications/${adding.parentId}/sub-classes`
      if (adding?.type === 'subsub') url = `/api/wo-classifications/${adding.parentId}/sub-classes/${adding.subParentId}/sub-sub-classes`
      const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: inputVal.trim() }) })
      if (!res.ok) { setError((await res.json()).error); return }
      const data = await res.json()
      if (adding?.type === 'class') {
        setClasses(p => [...p, { ...data, subClasses: [] }])
        setExpanded(p => ({ ...p, [data.id]: true }))
      } else if (adding?.type === 'sub') {
        setClasses(p => p.map(c => c.id === adding.parentId
          ? { ...c, subClasses: [...c.subClasses, { ...data, subSubClasses: [] }] }
          : c))
        setExpandedSub(p => ({ ...p, [data.id]: true }))
      } else if (adding?.type === 'subsub') {
        setClasses(p => p.map(c => ({
          ...c, subClasses: c.subClasses.map(s => s.id === adding.subParentId
            ? { ...s, subSubClasses: [...s.subSubClasses, data] }
            : s)
        })))
      }
      setAdding(null)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function startEdit(type: 'class' | 'sub' | 'subsub', id: string, name: string, parentId?: string) {
    setEditing({ type, id, parentId }); setInputVal(name); setError('')
  }

  async function commitEdit() {
    if (!inputVal.trim() || !editing) return
    setSaving(true); setError('')
    try {
      let url = ''
      if (editing.type === 'class')  url = `/api/wo-classifications/${editing.id}`
      if (editing.type === 'sub')    url = `/api/wo-classifications/${editing.parentId}/sub-classes/${editing.id}`
      if (editing.type === 'subsub') url = `/api/wo-classifications/x/sub-classes/x/sub-sub-classes/${editing.id}`
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: inputVal.trim() }) })
      if (!res.ok) { setError((await res.json()).error); return }
      const name = inputVal.trim()
      if (editing.type === 'class') setClasses(p => p.map(c => c.id === editing.id ? { ...c, name } : c))
      else if (editing.type === 'sub') setClasses(p => p.map(c => ({ ...c, subClasses: c.subClasses.map(s => s.id === editing.id ? { ...s, name } : s) })))
      else setClasses(p => p.map(c => ({ ...c, subClasses: c.subClasses.map(s => ({ ...s, subSubClasses: s.subSubClasses.map(ss => ss.id === editing.id ? { ...ss, name } : ss) })) })))
      setEditing(null)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function doDelete(type: 'class' | 'sub' | 'subsub', id: string, parentId?: string) {
    if (!confirm('Delete this item and all its children?')) return
    setSaving(true); setError('')
    try {
      let url = ''
      if (type === 'class')  url = `/api/wo-classifications/${id}`
      if (type === 'sub')    url = `/api/wo-classifications/${parentId}/sub-classes/${id}`
      if (type === 'subsub') url = `/api/wo-classifications/x/sub-classes/x/sub-sub-classes/${id}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) { setError((await res.json()).error); return }
      if (type === 'class') setClasses(p => p.filter(c => c.id !== id))
      else if (type === 'sub') setClasses(p => p.map(c => ({ ...c, subClasses: c.subClasses.filter(s => s.id !== id) })))
      else setClasses(p => p.map(c => ({ ...c, subClasses: c.subClasses.map(s => ({ ...s, subSubClasses: s.subSubClasses.filter(ss => ss.id !== id) })) })))
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  const InlineInput = ({ onCommit, onCancel }: { onCommit: () => void; onCancel: () => void }) => (
    <div className="flex items-center gap-2 mt-2 ml-2">
      <input autoFocus value={inputVal} onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        className="input-field text-sm flex-1 max-w-xs" placeholder="Enter name..." />
      <button onClick={onCommit} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
    </div>
  )

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {classes.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Tags className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No classes yet. Add your first class below.</p>
          </div>
        )}

        {classes.map(cls => (
          <div key={cls.id} className="p-4">
            {/* Class row */}
            <div className="flex items-center gap-2 group">
              <button onClick={() => toggleClass(cls.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                {expanded[cls.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {editing?.type === 'class' && editing.id === cls.id ? (
                <InlineInput onCommit={commitEdit} onCancel={() => setEditing(null)} />
              ) : (
                <span className="font-semibold text-gray-900 flex-1">{cls.name}</span>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit('class', cls.id, cls.name)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => doDelete('class', cls.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => { toggleClass(cls.id); startAdd('sub', cls.id) }}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                  <Plus className="w-3 h-3" /> Sub-Class
                </button>
              </div>
              <span className="text-xs text-gray-400">{cls.subClasses.length} sub-class{cls.subClasses.length !== 1 ? 'es' : ''}</span>
            </div>

            {/* Sub-class adding */}
            {adding?.type === 'sub' && adding.parentId === cls.id && (
              <InlineInput onCommit={commitAdd} onCancel={() => setAdding(null)} />
            )}

            {/* Sub-classes */}
            {expanded[cls.id] && (
              <div className="mt-3 ml-6 space-y-2 border-l-2 border-gray-100 pl-4">
                {cls.subClasses.map(sub => (
                  <div key={sub.id}>
                    <div className="flex items-center gap-2 group/sub">
                      <button onClick={() => toggleSub(sub.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {expandedSub[sub.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      {editing?.type === 'sub' && editing.id === sub.id ? (
                        <InlineInput onCommit={commitEdit} onCancel={() => setEditing(null)} />
                      ) : (
                        <span className="font-medium text-gray-700 flex-1 text-sm">{sub.name}</span>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                        <button onClick={() => startEdit('sub', sub.id, sub.name, cls.id)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => doDelete('sub', sub.id, cls.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        <button onClick={() => { setExpandedSub(p => ({ ...p, [sub.id]: true })); startAdd('subsub', cls.id, sub.id) }}
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100">
                          <Plus className="w-3 h-3" /> Sub-Sub
                        </button>
                      </div>
                      <span className="text-xs text-gray-400">{sub.subSubClasses.length}</span>
                    </div>

                    {/* Sub-sub adding */}
                    {adding?.type === 'subsub' && adding.subParentId === sub.id && (
                      <div className="ml-6">
                        <InlineInput onCommit={commitAdd} onCancel={() => setAdding(null)} />
                      </div>
                    )}

                    {/* Sub-sub-classes */}
                    {expandedSub[sub.id] && (
                      <div className="mt-2 ml-6 space-y-1 border-l-2 border-gray-100 pl-4">
                        {sub.subSubClasses.map(ss => (
                          <div key={ss.id} className="flex items-center gap-2 group/ss py-1">
                            <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                            {editing?.type === 'subsub' && editing.id === ss.id ? (
                              <InlineInput onCommit={commitEdit} onCancel={() => setEditing(null)} />
                            ) : (
                              <span className="text-sm text-gray-600 flex-1">{ss.name}</span>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover/ss:opacity-100 transition-opacity">
                              <button onClick={() => startEdit('subsub', ss.id, ss.name)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => doDelete('subsub', ss.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add top-level class */}
      {adding?.type === 'class' ? (
        <InlineInput onCommit={commitAdd} onCancel={() => setAdding(null)} />
      ) : (
        <button onClick={() => startAdd('class')}
          className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" />
          Add new class
        </button>
      )}
    </div>
  )
}
