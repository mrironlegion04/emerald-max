'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Check, AlertCircle, Package } from 'lucide-react'

interface ChecklistItem {
  id: string
  label: string
  type: string
  isChecked: boolean
  isMandatory: boolean
  stringValue: string | null
  options: string[]
  checkedAt: string | null
  checkedBy: string | null
  sortOrder: number
  assetId?: string | null
  asset?: {
    id: string
    name: string
    parentId: string | null
    location: {
      id: string
      name: string
      parentId: string | null
    } | null
  } | null
}

function isItemComplete(item: ChecklistItem): boolean {
  if (item.type === 'CHECKBOX') return item.isChecked
  return !!item.stringValue
}

interface Checklist {
  id: string
  title: string
  items: ChecklistItem[]
}

interface Props {
  woId: string
  initialChecklists: Checklist[]
  woStatus: string
  locations?: { id: string; name: string; parentId: string | null }[]
}

export default function WOChecklistPanel({ woId, initialChecklists, woStatus }: Props) {
  const router  = useRouter()
  const isClosed = ['COMPLETED','CANCELLED'].includes(woStatus)
  const [lists,       setLists]       = useState(initialChecklists)
  const [newTitle,    setNewTitle]    = useState('')
  const [newLabels,   setNewLabels]   = useState('')
  const [adding,      setAdding]      = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [toggling,    setToggling]    = useState<string | null>(null)
  const [error,       setError]       = useState('')

  const totalItems   = lists.reduce((s, l) => s + l.items.length, 0)
  const checkedItems = lists.reduce((s, l) => s + l.items.filter(i => isItemComplete(i)).length, 0)

  async function addChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true); setError('')
    try {
      const labels = newLabels.split('\n').map(l => l.trim()).filter(Boolean)
      const res  = await fetch(`/api/work-orders/${woId}/checklists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), items: labels }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setLists(prev => [...prev, data])
      setNewTitle(''); setNewLabels(''); setAdding(false)
      router.refresh()
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  async function toggleItem(listId: string, itemId: string, currentChecked: boolean) {
    setToggling(itemId)
    try {
      const res  = await fetch(`/api/work-orders/${woId}/checklists/${listId}/items/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: !currentChecked }),
      })
      const data = await res.json()
      if (!res.ok) return
      setLists(prev => prev.map(l => l.id !== listId ? l : {
        ...l, items: l.items.map(i => i.id !== itemId ? i : { ...i, isChecked: data.isChecked, stringValue: data.stringValue, checkedAt: data.checkedAt, checkedBy: data.checkedBy })
      }))
    } finally { setToggling(null) }
  }

  async function saveItemValue(listId: string, itemId: string, value: string | null) {
    setToggling(itemId)
    try {
      const res  = await fetch(`/api/work-orders/${woId}/checklists/${listId}/items/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stringValue: value }),
      })
      const data = await res.json()
      if (!res.ok) return
      setLists(prev => prev.map(l => l.id !== listId ? l : {
        ...l, items: l.items.map(i => i.id !== itemId ? i : { ...i, stringValue: data.stringValue, isChecked: data.isChecked, checkedAt: data.checkedAt, checkedBy: data.checkedBy })
      }))
    } finally { setToggling(null) }
  }

  async function deleteChecklist(listId: string) {
    try {
      await fetch(`/api/work-orders/${woId}/checklists/${listId}`, { method: 'DELETE' })
      setLists(prev => prev.filter(l => l.id !== listId))
      router.refresh()
    } catch { /* ignore */ }
  }

  const pct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

  // ── Flat asset-grouped items ──

  function groupItemsByAsset(items: ChecklistItem[]): { assetName: string; items: ChecklistItem[] }[] {
    const groups = new Map<string, ChecklistItem[]>()
    const ungrouped: ChecklistItem[] = []

    for (const item of items) {
      if (item.asset) {
        const key = item.asset.name
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(item)
      } else {
        ungrouped.push(item)
      }
    }

    const result: { assetName: string; items: ChecklistItem[] }[] = []
    for (const [assetName, assetItems] of groups) {
      result.push({ assetName, items: assetItems.sort((a, b) => a.sortOrder - b.sortOrder) })
    }
    result.sort((a, b) => a.assetName.localeCompare(b.assetName))

    if (ungrouped.length > 0) {
      result.unshift({ assetName: 'General Tasks', items: ungrouped.sort((a, b) => a.sortOrder - b.sortOrder) })
    }

    return result
  }

  // ── Item row rendering ──

  function renderChecklistItemRow(item: ChecklistItem, listId: string) {
    const complete = isItemComplete(item)

    return (
      <div
        key={item.id}
        className={`flex items-start gap-3 p-2.5 rounded-lg transition-all border border-transparent ${
          complete ? 'bg-green-50/40 hover:bg-green-50/60 border-green-100/50' : 'hover:bg-gray-50/80 hover:border-gray-100'
        }`}
      >
        {item.type === 'CHECKBOX' ? (
          <button
            type="button"
            onClick={() => !isClosed && toggleItem(listId, item.id, item.isChecked)}
            disabled={toggling === item.id || isClosed}
            className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
              item.isChecked
                ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-100 scale-105'
                : 'border-gray-300 hover:border-green-500 hover:bg-green-50/20'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {item.isChecked && (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            )}
          </button>
        ) : item.type === 'INSPECTION' ? (
          <div className="flex gap-1 mt-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => !isClosed && saveItemValue(listId, item.id, 'PASS')}
              disabled={isClosed}
              className={`px-2 py-1 text-xs font-semibold rounded border transition-all ${
                item.stringValue === 'PASS'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'border-gray-300 text-gray-500 hover:border-green-400'
              } disabled:opacity-50`}
            >
              ✓ PASS
            </button>
            <button
              type="button"
              onClick={() => !isClosed && saveItemValue(listId, item.id, 'FAIL')}
              disabled={isClosed}
              className={`px-2 py-1 text-xs font-semibold rounded border transition-all ${
                item.stringValue === 'FAIL'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-gray-300 text-gray-500 hover:border-red-400'
              } disabled:opacity-50`}
            >
              ✗ FAIL
            </button>
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm transition-all ${
              complete ? 'line-through text-gray-400 font-normal' : 'text-gray-700 font-medium'
            }`}>
              {item.label}
            </p>
            {item.type !== 'CHECKBOX' && (
              <span className="text-[10px] text-gray-400 font-mono uppercase">{item.type === 'INSPECTION' ? 'PASS/FAIL' : item.type.replace('_', ' ')}</span>
            )}
            {item.isMandatory && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-100">
                <AlertCircle className="w-2.5 h-2.5" />
                Required
              </span>
            )}
          </div>

          {item.type === 'TEXT_INPUT' && !isClosed && (
            <input
              type="text"
              defaultValue={item.stringValue ?? ''}
              onBlur={e => saveItemValue(listId, item.id, e.target.value || null)}
              disabled={toggling === item.id}
              className="mt-1.5 w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 disabled:opacity-50"
              placeholder="Enter text..."
            />
          )}
          {item.type === 'TEXT_INPUT' && isClosed && item.stringValue && (
            <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{item.stringValue}&rdquo;</p>
          )}
          {item.type === 'NUMBER_INPUT' && !isClosed && (
            <input
              type="number"
              defaultValue={item.stringValue ?? ''}
              onBlur={e => saveItemValue(listId, item.id, e.target.value || null)}
              disabled={toggling === item.id}
              className="mt-1.5 w-32 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 disabled:opacity-50"
              placeholder="0"
              step="any"
            />
          )}
          {item.type === 'NUMBER_INPUT' && isClosed && item.stringValue && (
            <p className="text-xs text-gray-600 mt-1">{item.stringValue}</p>
          )}
          {item.type === 'SINGLE_SELECT' && !isClosed && (
            <select
              defaultValue={item.stringValue ?? ''}
              onChange={e => saveItemValue(listId, item.id, e.target.value || null)}
              disabled={toggling === item.id}
              className="mt-1.5 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 disabled:opacity-50"
            >
              <option value="">Select...</option>
              {item.options.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
          {item.type === 'SINGLE_SELECT' && isClosed && item.stringValue && (
            <p className="text-xs text-gray-600 mt-1">Selected: {item.stringValue}</p>
          )}
          {item.type === 'SIGNATURE' && !isClosed && (
            <div className="mt-1.5">
              {item.stringValue ? (
                <div className="flex items-center gap-2">
                  <img src={item.stringValue} alt="Signature" className="h-10 border border-gray-200 rounded" />
                  <button
                    type="button"
                    onClick={() => saveItemValue(listId, item.id, null)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.createElement('canvas')
                    canvas.width = 300; canvas.height = 80
                    const ctx = canvas.getContext('2d')
                    if (!ctx) return
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 80)
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 2
                    ctx.font = '14px sans-serif'
                    ctx.fillStyle = '#999'
                    ctx.fillText('Signature pad placeholder', 20, 45)
                    saveItemValue(listId, item.id, canvas.toDataURL())
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Sign
                </button>
              )}
            </div>
          )}
          {item.type === 'SIGNATURE' && isClosed && item.stringValue && (
            <img src={item.stringValue} alt="Signature" className="mt-1 h-10 border border-gray-200 rounded" />
          )}

          {complete && item.checkedBy && (
            <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
              {item.type === 'CHECKBOX' ? 'Checked' : 'Completed'} by {item.checkedBy} · {item.checkedAt ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(item.checkedAt)) : ''}
            </p>
          )}
        </div>
        {!isClosed && (
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/work-orders/${woId}/checklists/${listId}/items/${item.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isMandatory: !item.isMandatory }),
                })
                if (res.ok) {
                  setLists(prev => prev.map(l => l.id !== listId ? l : {
                    ...l, items: l.items.map(i => i.id !== item.id ? i : { ...i, isMandatory: !item.isMandatory })
                  }))
                }
              } catch { /* ignore */ }
            }}
            className="text-xs text-gray-400 hover:text-orange-500 transition-colors font-medium px-2 py-1 rounded hover:bg-gray-100 flex-shrink-0"
            title={item.isMandatory ? 'Remove required' : 'Mark as required'}
          >
            {item.isMandatory ? '◆' : '◇'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200/50 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/10">
        <div className="flex items-center gap-2.5">
          <h2 className="font-bold text-slate-805 text-sm tracking-tight">Checklists</h2>
          {totalItems > 0 && (
            <span className="text-[11px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
              {checkedItems}/{totalItems} completed
            </span>
          )}
        </div>
        {!isClosed && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:text-blue-850 hover:underline font-bold transition">
            + Add checklist
          </button>
        )}
      </div>

      {/* Progress bar */}
      {totalItems > 0 && (
        <div className="px-5 py-3.5 border-b border-slate-100/60 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500 transition-all shadow-xs" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-705 w-9 text-right">{pct}%</span>
          </div>
        </div>
      )}

      {/* Add checklist form */}
      {adding && (
        <form onSubmit={addChecklist} className="px-5 py-4 border-b border-slate-100 bg-blue-50/30 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Checklist title</label>
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              className="input-field text-xs bg-white border-slate-200" placeholder="e.g. Safety checks" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Items (one per line)</label>
            <textarea value={newLabels} onChange={e => setNewLabels(e.target.value)}
              className="input-field text-xs bg-white border-slate-200 resize-none font-sans" rows={4}
              placeholder={"Check oil level\nInspect belts\nTest pressure relief valve"} />
          </div>
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1.5 rounded">{error}</p>}
          <div className="flex gap-2 pt-1.5">
            <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-4 shadow-sm font-bold">
              {saving ? 'Adding...' : 'Add checklist'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} className="btn-secondary text-xs py-2 px-4 font-bold">Cancel</button>
          </div>
        </form>
      )}

      {/* Checklists — flat asset-grouped rendering */}
      {lists.length === 0 && !adding ? (
        <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white">No checklists added</div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white">
          {lists.map(list => {
            const listPct = list.items.length > 0
              ? Math.round((list.items.filter(i => isItemComplete(i)).length / list.items.length) * 100)
              : 0

            const assetGroups = groupItemsByAsset(list.items)

            return (
              <div key={list.id} className="px-5 py-4 first:pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{list.title}</span>
                    <span className="text-xs bg-slate-50 border border-slate-100 font-semibold px-2 py-0.5 rounded-full text-slate-500">
                      {list.items.filter(i => isItemComplete(i)).length}/{list.items.length}
                    </span>
                    {listPct === 100 && list.items.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">Done</span>
                    )}
                  </div>
                  {!isClosed && (
                    <button onClick={() => deleteChecklist(list.id)} className="text-slate-300 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Flat asset-grouped rendering */}
                {assetGroups.length > 0 ? (
                  <div className="space-y-4">
                    {assetGroups.map(group => (
                      <div key={group.assetName}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Package className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {group.assetName}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {group.items.map(item => renderChecklistItemRow(item, list.id))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2 font-medium">No items in this checklist</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
