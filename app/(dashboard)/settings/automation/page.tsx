'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Power, PowerOff, ChevronDown, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

interface AutomationRule {
  id: string
  name: string
  description: string | null
  isActive: boolean
  priority: number
  triggerType: string
  conditions: Array<{ field: string; operator: string; value: any }>
  actions: Array<{ type: string; params: Record<string, any> }>
  createdBy: { name: string } | null
  createdAt: string
}

const TRIGGER_TYPES = [
  { value: 'WO_CREATED', label: 'Work Order Created' },
  { value: 'WO_COMPLETED', label: 'Work Order Completed' },
  { value: 'WO_CANCELLED', label: 'Work Order Cancelled' },
  { value: 'PART_LOW_STOCK', label: 'Part Low on Stock' },
]

const WO_FIELDS = [
  { value: 'priority', label: 'Priority' },
  { value: 'type', label: 'Type' },
  { value: 'status', label: 'Status' },
  { value: 'categoryId', label: 'Category' },
  { value: 'hasAsset', label: 'Has Asset' },
  { value: 'hasDescription', label: 'Has Description' },
  { value: 'isPmGenerated', label: 'PM Generated' },
]

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'Is One Of' },
]

const ACTION_TYPES = [
  { value: 'assign_user', label: 'Assign User' },
  { value: 'set_priority', label: 'Set Priority' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'update_field', label: 'Update Field' },
]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export default function AutomationPage() {
  const router = useRouter()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('WO_CREATED')
  const [conditions, setConditions] = useState<Array<{ field: string; operator: string; value: string }>>([])
  const [actions, setActions] = useState<Array<{ type: string; params: Record<string, any> }>>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadRules() }, [])

  async function loadRules() {
    try {
      const res = await fetch('/api/automation-rules')
      const data = await res.json()
      if (res.ok) setRules(data)
    } finally { setLoading(false) }
  }

  function openCreate() {
    setEditingRule(null)
    setName('')
    setDescription('')
    setTriggerType('WO_CREATED')
    setConditions([])
    setActions([])
    setShowForm(true)
    setError('')
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule)
    setName(rule.name)
    setDescription(rule.description || '')
    setTriggerType(rule.triggerType)
    setConditions(rule.conditions || [])
    setActions(rule.actions || [])
    setShowForm(true)
    setError('')
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const url = editingRule ? `/api/automation-rules/${editingRule.id}` : '/api/automation-rules'
      const method = editingRule ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, triggerType, conditions, actions }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setShowForm(false)
      loadRules()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/automation-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    loadRules()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/automation-rules/${id}`, { method: 'DELETE' })
    loadRules()
  }

  function addCondition() {
    setConditions([...conditions, { field: 'priority', operator: 'equals', value: 'HIGH' }])
  }

  function updateCondition(index: number, key: string, value: string) {
    const updated = [...conditions]
    updated[index] = { ...updated[index], [key]: value }
    setConditions(updated)
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  function addAction() {
    setActions([...actions, { type: 'send_notification', params: { userId: '', title: '', message: '' } }])
  }

  function updateAction(index: number, key: string, value: any) {
    const updated = [...actions]
    updated[index] = { ...updated[index], params: { ...updated[index].params, [key]: value } }
    setActions(updated)
  }

  function updateActionType(index: number, type: string) {
    const updated = [...actions]
    updated[index] = { type, params: {} }
    setActions(updated)
  }

  function removeAction(index: number) {
    setActions(actions.filter((_, i) => i !== index))
  }

  const triggerLabel = (t: string) => TRIGGER_TYPES.find(x => x.value === t)?.label ?? t

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Automation Rules"
        subtitle="Automate actions based on work order events"
        action={
          <button onClick={openCreate} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Rule
          </button>
        }
      />

      {/* Rules list */}
      <div className="space-y-3">
        {loading && <div className="text-center py-8 text-sm text-slate-400">Loading rules...</div>}
        {!loading && rules.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <p className="text-sm text-slate-500">No automation rules yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first rule to automate work order actions</p>
          </div>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <button onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)} className="text-slate-400 hover:text-slate-600">
                {expandedRule === rule.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{rule.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    {triggerLabel(rule.triggerType)}
                  </span>
                </div>
                {rule.description && <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>}
                <div className="flex items-center gap-4 mt-1 text-[10px] text-slate-400">
                  <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}</span>
                  <span>{rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}</span>
                  {rule.createdBy && <span>by {rule.createdBy.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(rule.id, rule.isActive)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title={rule.isActive ? 'Deactivate' : 'Activate'}>
                  {rule.isActive ? <Power className="w-4 h-4 text-emerald-500" /> : <PowerOff className="w-4 h-4 text-slate-400" />}
                </button>
                <button onClick={() => openEdit(rule)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expandedRule === rule.id && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                {rule.conditions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Conditions</p>
                    <div className="space-y-1">
                      {rule.conditions.map((c, i) => (
                        <div key={i} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5 font-mono">
                          {c.field} {c.operator} {String(c.value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {rule.actions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Actions</p>
                    <div className="space-y-1">
                      {rule.actions.map((a, i) => (
                        <div key={i} className="text-xs text-slate-600 bg-blue-50 rounded-lg px-3 py-1.5 font-mono">
                          {a.type}: {JSON.stringify(a.params)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <h2 className="font-bold text-lg text-slate-800">{editingRule ? 'Edit Rule' : 'New Automation Rule'}</h2>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

              {/* Basic info */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="input-field w-full text-sm" placeholder="e.g. Auto-assign high priority WOs" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description (optional)</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} className="input-field w-full text-sm" placeholder="What does this rule do?" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Trigger</label>
                  <select value={triggerType} onChange={e => setTriggerType(e.target.value)} className="input-field w-full text-sm">
                    {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conditions (optional)</label>
                  <button onClick={addCondition} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {conditions.length === 0 && <p className="text-xs text-slate-400 italic">No conditions — rule runs on every trigger</p>}
                <div className="space-y-2">
                  {conditions.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)} className="input-field text-xs flex-1">
                        {WO_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select value={c.operator} onChange={e => updateCondition(i, 'operator', e.target.value)} className="input-field text-xs flex-1">
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} className="input-field text-xs flex-1" placeholder="Value" />
                      <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</label>
                  <button onClick={addAction} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {actions.length === 0 && <p className="text-xs text-slate-400 italic">No actions defined</p>}
                <div className="space-y-3">
                  {actions.map((a, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <select value={a.type} onChange={e => updateActionType(i, e.target.value)} className="input-field text-xs flex-1">
                          {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {a.type === 'set_priority' && (
                        <select value={a.params.priority || ''} onChange={e => updateAction(i, 'priority', e.target.value)} className="input-field text-xs w-full">
                          <option value="">Select priority</option>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                      {a.type === 'send_notification' && (
                        <div className="space-y-2">
                          <input value={a.params.title || ''} onChange={e => updateAction(i, 'title', e.target.value)} className="input-field text-xs w-full" placeholder="Notification title" />
                          <input value={a.params.message || ''} onChange={e => updateAction(i, 'message', e.target.value)} className="input-field text-xs w-full" placeholder="Notification message" />
                        </div>
                      )}
                      {a.type === 'assign_user' && (
                        <input value={a.params.userId || ''} onChange={e => updateAction(i, 'userId', e.target.value)} className="input-field text-xs w-full" placeholder="User ID" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-4 py-2">
                {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
