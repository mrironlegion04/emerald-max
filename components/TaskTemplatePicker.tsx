'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Template {
  id: string
  name: string
  _count: { tasks: number }
}

interface Props {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function TaskTemplatePicker({ selectedIds, onChange }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/task-templates')
      .then(r => r.json())
      .then(data => setTemplates(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const selected = templates.filter(t => selectedIds.includes(t.id))

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter(x => x !== id))
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Task Templates</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
              {t.name}
              <span className="text-blue-400">({t._count.tasks})</span>
              <button type="button" onClick={() => remove(t.id)} className="text-blue-400 hover:text-blue-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button type="button" onClick={() => setOpen(v => !v)}
          className="input-field w-full text-sm text-left flex items-center justify-between">
          <span className="text-gray-400">Select templates...</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search templates..." className="input-field w-full text-xs" />
            </div>
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">No templates found</p>
            ) : (
              filtered.map(t => (
                <label key={t.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none">
                  <input type="checkbox" checked={selectedIds.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">{t._count.tasks} task{t._count.tasks !== 1 ? 's' : ''}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
