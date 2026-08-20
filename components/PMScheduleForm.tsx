'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Layers, ArrowUp, ArrowDown, ListChecks, Upload, Download } from 'lucide-react'
import AssetTreeSelect from './AssetTreeSelect'
import LocationSelect from './LocationSelect'
import { parseCSV } from '@/lib/csv'

interface SimpleMeter {
  id: string
  name: string
  unit: string
  meterType: string
  isPrimary: boolean
  lastValue: number | null
}

interface Asset    { id: string; name: string; assetCode: string | null; imageUrl?: string | null; parentId?: string | null; locationId?: string | null; categoryId?: string | null }
interface Location { id: string; name: string; address: string | null; path: string | null; parentId: string | null }
interface NestedTier {
  label: string
  frequency: string
  interval: number
  runEvery: number
  enabled: boolean
}

interface PMTask {
  title: string
  description: string
  priority: string
  assignedToId: string
  assignedTeamId: string
  required: boolean
}

interface SimpleUser {
  id: string
  name: string
  email: string
}

interface SimpleTeam {
  id: string
  name: string
}

interface PMFormData {
  title: string; description: string
  triggerType: string; frequency: string; interval: string
  meterInterval: string; meterUnit: string; meterId: string
  nextDueDate: string; assetId: string; assetIds: string[]; locationId: string; locationScope: string; isActive: boolean
  // MaintainX-style fields
  scheduleBehavior: string; schedulingHorizon: string
  // WO Template fields
  woPriority: string; woDescription: string; woAssignedToId: string
  woTeamId: string
  // Start date offset
  startDateOffset: string
  // Nested start index
  nestedStartIndex: string
  // Recurrence rule (MaintWiz-style monthly rules)
  recurrenceType: string
  recurrenceDayOfWeek: string
  recurrenceOccurrence: string
  recurrenceDayOfMonth: string
  occurrenceLimit: string
  endDate: string
}

interface Props {
  assets:     Asset[]
  locations:  Location[]
  users?:     SimpleUser[]
  teams?:     SimpleTeam[]
  initialData?: Partial<PMFormData> & { nestedConfig?: NestedTier[] | null; tasks?: PMTask[] | null }
  scheduleId?: string
  preselectedAssetId?: string
}

const freqOptions = [
  { value: 'HOURLY',     label: 'Hourly' },
  { value: 'DAILY',      label: 'Daily' },
  { value: 'WEEKLY',     label: 'Weekly' },
  { value: 'MONTHLY',    label: 'Monthly' },
  { value: 'QUARTERLY',  label: 'Quarterly' },
  { value: 'YEARLY',     label: 'Yearly' },
]

const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
  '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
}
const OCCURRENCE_LABELS: Record<string, string> = {
  '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth', '5': 'Fifth', '-1': 'Last',
}

const METER_UNITS = [
  // Distance
  { value: 'Miles', label: 'Miles' },
  { value: 'Kilometers', label: 'Kilometers' },
  { value: 'Meters', label: 'Meters' },
  { value: 'Feet', label: 'Feet' },
  // Time
  { value: 'Hours', label: 'Hours' },
  { value: 'Days', label: 'Days' },
  // Volume
  { value: 'Gallons', label: 'Gallons (US)' },
  { value: 'Liters', label: 'Liters' },
  { value: 'Cubic Meters', label: 'Cubic Meters' },
  // Weight
  { value: 'Pounds', label: 'Pounds' },
  { value: 'Kilograms', label: 'Kilograms' },
  { value: 'Tons', label: 'Tons (US)' },
  // Counts
  { value: 'Cycles', label: 'Cycles' },
  { value: 'Revolutions', label: 'Revolutions' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Starts', label: 'Starts' },
  // Power/Energy
  { value: 'kWh', label: 'kWh (kilowatt-hours)' },
  { value: 'Watts', label: 'Watts' },
  { value: 'Kilowatts', label: 'Kilowatts' },
  { value: 'HP', label: 'Horsepower' },
  // Pressure
  { value: 'PSI', label: 'PSI' },
  { value: 'Bar', label: 'Bar' },
  { value: 'kPa', label: 'kPa' },
  // Flow
  { value: 'GPM', label: 'GPM (Gallons/min)' },
  { value: 'LPM', label: 'LPM (Liters/min)' },
  { value: 'CFM', label: 'CFM (Cubic ft/min)' },
  // Other
  { value: 'Percentage', label: 'Percentage (%)' },
  { value: 'Percentage (Hours left)', label: 'Percentage (Hours left)' },
]

// Default next due = 1 week from today
function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

function recurrenceSummary(frequency: string, interval: string, type: string, occurrence: string, dayOfWeek: string, dayOfMonth: string): string {
  const every = `every ${interval === '1' ? '' : `${interval} `}month${interval === '1' ? '' : 's'}`
  if (frequency !== 'MONTHLY') {
    return `every ${interval === '1' ? '' : `${interval} `}${freqOptions.find(f => f.value === frequency)?.label.toLowerCase() ?? 'month'}`
  }
  if (type === 'NTH_WEEKDAY') {
    const occ = (OCCURRENCE_LABELS[occurrence] ?? 'First').toLowerCase()
    const dow = (WEEKDAY_LABELS[dayOfWeek] ?? 'monday').toLowerCase()
    return `on the ${occ} ${dow} of ${every}`
  }
  if (type === 'DAY_OF_MONTH') {
    const day = dayOfMonth === '-1' ? 'last day' : `day ${dayOfMonth}`
    return `on the ${day} of ${every}`
  }
  return every
}

export default function PMScheduleForm({ assets, locations, users = [], teams = [], initialData, scheduleId, preselectedAssetId }: Props) {
  const router = useRouter()
  const isEdit = !!scheduleId

  const [form, setForm] = useState<PMFormData>({
    title:              initialData?.title              ?? '',
    description:        initialData?.description        ?? '',
    triggerType:        initialData?.triggerType        ?? 'TIME',
    frequency:          initialData?.frequency          ?? 'MONTHLY',
    interval:           initialData?.interval           ?? '1',
    meterInterval:      initialData?.meterInterval?.toString() ?? '',
    meterUnit:          initialData?.meterUnit          ?? '',
    meterId:            (initialData as any)?.meterId   ?? '',
    nextDueDate:        initialData?.nextDueDate        ?? defaultDueDate(),
    assetId:            initialData?.assetId            ?? preselectedAssetId ?? '',
    assetIds:           (initialData as any)?.assetIds?.length
      ? (initialData as any).assetIds
      : (initialData?.assetId
          ? [initialData.assetId]
          : (preselectedAssetId ? [preselectedAssetId] : [])),
    locationId:         initialData?.locationId         ?? '',
    locationScope:      initialData?.locationScope      ?? 'ALL_ASSETS',
    isActive:           initialData?.isActive           ?? true,

    scheduleBehavior:   (initialData as any)?.scheduleBehavior ?? 'FIXED',
    schedulingHorizon:  (initialData as any)?.schedulingHorizon ?? '1',
    woPriority:         (initialData as any)?.woPriority        ?? 'MEDIUM',
    woDescription:      (initialData as any)?.woDescription     ?? '',
    woAssignedToId:     (initialData as any)?.woAssignedToId    ?? '',
    woTeamId:           (initialData as any)?.woTeamId          ?? '',
    startDateOffset:    (initialData as any)?.startDateOffset   ?? '0',
    nestedStartIndex:   (initialData as any)?.nestedStartIndex  ?? '0',
    recurrenceType:     (initialData as any)?.recurrenceRule?.type ?? '',
    recurrenceDayOfWeek: (initialData as any)?.recurrenceRule?.dayOfWeek != null
      ? String((initialData as any).recurrenceRule.dayOfWeek) : '0',
    recurrenceOccurrence: (initialData as any)?.recurrenceRule?.occurrence != null
      ? String((initialData as any).recurrenceRule.occurrence) : '1',
    recurrenceDayOfMonth: (initialData as any)?.recurrenceRule?.dayOfMonth != null
      ? String((initialData as any).recurrenceRule.dayOfMonth) : '1',
    occurrenceLimit:    (initialData as any)?.occurrenceLimit != null
      ? String((initialData as any).occurrenceLimit) : '',
    endDate:            (initialData as any)?.endDate
      ? new Date((initialData as any).endDate).toISOString().split('T')[0] : '',
  })

  const [nestedTiers, setNestedTiers] = useState<NestedTier[]>(
    (initialData as any)?.nestedConfig ?? []
  )
  const nestedEnabled = nestedTiers.length > 0

  const [tasks, setTasks] = useState<PMTask[]>(
    (initialData as any)?.tasks ?? []
  )
  const [showAllTasks, setShowAllTasks] = useState(false)
  const VISIBLE_TASKS = 10

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [targetType, setTargetType] = useState<'ASSET' | 'LOCATION'>(
    (initialData?.locationId && !initialData?.assetId && !preselectedAssetId) ? 'LOCATION' : 'ASSET'
  )

  const handleToggleTarget = (type: 'ASSET' | 'LOCATION') => {
    setTargetType(type)
    if (type === 'ASSET') {
      setForm(prev => ({ ...prev, locationId: '', locationScope: 'ALL_ASSETS' }))
    } else {
      setForm(prev => ({ ...prev, assetId: '', assetIds: [] }))
    }
  }

  function set(field: keyof PMFormData, value: string | boolean | string[]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleFrequencyChange(value: string) {
    set('frequency', value)
    if (value !== 'MONTHLY') set('recurrenceType', '')
  }

  // Fetch meters for the selected asset
  const [meters, setMeters] = useState<SimpleMeter[]>([])
  const [loadingMeters, setLoadingMeters] = useState(false)
  useEffect(() => {
    if (!form.assetId) { setMeters([]); return }
    setLoadingMeters(true)
    fetch(`/api/assets/${form.assetId}/meters`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMeters(data))
      .catch(() => setMeters([]))
      .finally(() => setLoadingMeters(false))
  }, [form.assetId])

  function handleMeterChange(meterId: string) {
    const meter = meters.find(m => m.id === meterId)
    set('meterId', meterId)
    set('meterUnit', meter?.unit ?? '')
    if (meter?.lastValue != null) {
      set('meterInterval', String(meter.lastValue))
    }
  }

  // Nested PM tier management
  function addNestedTier() {
    setNestedTiers(prev => [
      ...prev,
      {
        label: '',
        frequency: form.frequency,
        interval: 1,
        runEvery: prev.length + 2,
        enabled: true,
      },
    ])
  }

  function updateNestedTier(index: number, field: keyof NestedTier, value: string | number | boolean) {
    setNestedTiers(prev => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  function removeNestedTier(index: number) {
    setNestedTiers(prev => prev.filter((_, i) => i !== index))
  }

  // Task template management
  function addTask() {
    setTasks(prev => [...prev, { title: '', description: '', priority: 'MEDIUM', assignedToId: '', assignedTeamId: '', required: true }])
  }

  function updateTask(index: number, field: keyof PMTask, value: string | boolean) {
    setTasks(prev => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  function removeTask(index: number) {
    setTasks(prev => prev.filter((_, i) => i !== index))
  }

  function moveTask(index: number, dir: -1 | 1) {
    setTasks(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  // CSV bulk-import into the task template (appends to existing tasks)
  const taskCsvInputRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  function downloadTaskCsvSample() {
    const csv = [
      'title,description,priority,assigned_to,assigned_team,required',
      'Check belt tension,Inspect and adjust tension,,Ankit Mehta,,required',
      'Lubricate bearings,,medium,,Maintenance Team,required',
      'Replace worn seals,Check seal condition and replace if damaged,high,,Mechanical,optional',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'pm-task-template.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  function handleTaskCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const records = parseCSV(String(reader.result ?? ''))
      if (records.length === 0) { setImportMsg('No rows found in the CSV. Check the file and try again.'); return }
      let skipped = 0
      let unmatched = 0
      const mapped: PMTask[] = []
      for (const row of records) {
        const title = (row.title ?? '').trim()
        if (!title) { skipped++; continue }
        const assigneeRaw = (row.assigned_to ?? row.assignee ?? '').trim()
        let assignedToId = ''
        if (assigneeRaw) {
          const target = assigneeRaw.toLowerCase()
          const byEmail = users.find(u => u.email.toLowerCase() === target)
          const match = byEmail ?? users.find(u => u.name.toLowerCase() === target)
          if (match) assignedToId = match.id
          else unmatched++
        }
        const teamRaw = (row.assigned_team ?? row.team ?? '').trim()
        let assignedTeamId = ''
        if (teamRaw) {
          const target = teamRaw.toLowerCase()
          const match = teams.find(t => t.name.toLowerCase() === target)
          if (match) assignedTeamId = match.id
        }
        const priorityRaw = (row.priority ?? '').trim().toUpperCase()
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        const priority = validPriorities.includes(priorityRaw) ? priorityRaw : 'MEDIUM'
        mapped.push({
          title,
          description: (row.description ?? '').trim(),
          priority,
          assignedToId,
          assignedTeamId,
          required: /^(yes|true|1|required)$/i.test((row.required ?? '').trim()),
        })
      }
      if (mapped.length === 0) { setImportMsg('No usable rows found (all titles were empty). Nothing added.'); return }
      setTasks(prev => [...prev, ...mapped])
      setImportMsg(
        `Imported ${mapped.length} task${mapped.length === 1 ? '' : 's'}` +
        (skipped ? `, skipped ${skipped} empty row${skipped === 1 ? '' : 's'}` : '') +
        (unmatched ? `, ${unmatched} assignee${unmatched === 1 ? '' : 's'} not found (left unassigned)` : '') + '.'
      )
    }
    reader.readAsText(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    if (form.assetIds.length === 0 && !form.locationId) { setError('Either Asset or Location must be selected'); setSaving(false); return }
    try {
      const payload = {
        title:                form.title,
        description:          form.description || null,
        triggerType:          form.triggerType,
        frequency:            form.frequency,
        interval:             parseInt(form.interval),
        nextDueDate:          form.nextDueDate,
        meterId:              form.triggerType === 'METER' || form.triggerType === 'TIME_OR_METER' ? (form.meterId || null) : null,
        meterInterval:        form.triggerType === 'METER' || form.triggerType === 'TIME_OR_METER' ? parseFloat(form.meterInterval) : null,
        meterUnit:            form.triggerType === 'METER' || form.triggerType === 'TIME_OR_METER' ? form.meterUnit : null,
        assetId:              form.assetIds[0] ?? null,
        assetIds:             form.assetIds,
        locationId:           form.locationId || null,
        locationScope:        form.locationId && !form.assetId ? form.locationScope : null,

        scheduleBehavior:     form.scheduleBehavior,
        schedulingHorizon:    parseInt(form.schedulingHorizon) || 1,
        nestedConfig:         nestedTiers.length > 0 ? nestedTiers : null,
        woPriority:           form.woPriority,
        woDescription:        form.woDescription || null,
        woAssignedToId:       form.woAssignedToId || null,
        woTeamId:             form.woTeamId || null,
        startDateOffset:      parseInt(form.startDateOffset) || 0,
        nestedStartIndex:     parseInt(form.nestedStartIndex) || 0,
        recurrenceRule:       form.frequency === 'MONTHLY' && form.recurrenceType === 'NTH_WEEKDAY'
          ? { type: 'NTH_WEEKDAY', dayOfWeek: parseInt(form.recurrenceDayOfWeek) || 0, occurrence: parseInt(form.recurrenceOccurrence) || 1 }
          : form.frequency === 'MONTHLY' && form.recurrenceType === 'DAY_OF_MONTH'
            ? { type: 'DAY_OF_MONTH', dayOfMonth: parseInt(form.recurrenceDayOfMonth) || 1 }
            : null,
        occurrenceLimit:      form.occurrenceLimit ? parseInt(form.occurrenceLimit) : null,
        endDate:              form.endDate || null,
        tasks:                tasks
          .filter(t => t.title.trim())
          .map(t => ({
            title: t.title.trim(),
            description: t.description.trim() || null,
            priority: t.priority,
            assignedToId: t.assignedToId || null,
            assignedTeamId: t.assignedTeamId || null,
            required: t.required,
          })),
      }
      const url    = isEdit ? `/api/pm/${scheduleId}` : '/api/pm'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/preventive-maintenance/${data.id}`)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Core info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Schedule details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
            className="input-field" placeholder="e.g. Monthly oil change" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input-field resize-none" rows={3}
            placeholder="Describe the maintenance tasks to be performed..." />
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Maintenance Target</p>
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => handleToggleTarget('ASSET')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                targetType === 'ASSET'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Asset
            </button>
            <button
              type="button"
              onClick={() => handleToggleTarget('LOCATION')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                targetType === 'LOCATION'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Location
            </button>
          </div>
        </div>

        {targetType === 'ASSET' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assets</label>
            <AssetTreeSelect
              assets={assets}
              value={form.assetIds}
              onChange={ids => {
                const arr = Array.isArray(ids) ? ids : (ids ? [ids] : [])
                set('assetIds', arr)
                set('assetId', arr[0] ?? '')
              }}
              multiSelect
              placeholder="— Select one or more assets —"
            />
            <p className="text-xs text-gray-400 mt-1">
              Creates a work order for each selected asset. The first asset is used for meter-based triggers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <LocationSelect
                locations={locations}
                value={form.locationId}
                onChange={id => set('locationId', id)}
                placeholder="— Select a location —"
              />
            </div>

            {form.locationId && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600">Scope of work</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="locationScope"
                      value="ALL_ASSETS"
                      checked={form.locationScope === 'ALL_ASSETS'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">All Assets in this Location</p>
                      <p className="text-xs text-gray-500">Creates a checklist for each asset recursively</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="locationScope"
                      value="GENERAL"
                      checked={form.locationScope === 'GENERAL'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">General Maintenance</p>
                      <p className="text-xs text-gray-500">Location-only ticket (no asset checklist)</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trigger type & Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Trigger type</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => set('triggerType', 'TIME')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              form.triggerType === 'TIME'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Time-based
          </button>
          <button
            type="button"
            onClick={() => set('triggerType', 'METER')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              form.triggerType === 'METER'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Meter-based
          </button>
          <button
            type="button"
            onClick={() => set('triggerType', 'TIME_OR_METER')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              form.triggerType === 'TIME_OR_METER'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Time or Usage
          </button>
          <button
            type="button"
            onClick={() => set('triggerType', 'EVENT')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              form.triggerType === 'EVENT'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Condition/Event
          </button>
        </div>

        {form.triggerType === 'EVENT' && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-700">
              Condition/event-based schedules are generated manually (or by an external
              event) — the due date does not auto-advance.
            </p>
          </div>
        )}

        {(form.triggerType === 'TIME' || form.triggerType === 'TIME_OR_METER') && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat every</label>
                <input type="number" min="1" max="365" value={form.interval}
                  onChange={e => set('interval', e.target.value)}
                  className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select value={form.frequency} onChange={e => handleFrequencyChange(e.target.value)} className="input-field">
                  {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {form.frequency === 'MONTHLY' && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repeats on</label>
                  <select value={form.recurrenceType} onChange={e => set('recurrenceType', e.target.value)} className="input-field">
                    <option value="">Same day of the month</option>
                    <option value="NTH_WEEKDAY">The Nth weekday of the month</option>
                    <option value="DAY_OF_MONTH">A specific day of the month</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    e.g. &ldquo;The first Monday of every month&rdquo;, &ldquo;The last day of every month&rdquo;.
                  </p>
                </div>

                {form.recurrenceType === 'NTH_WEEKDAY' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Occurrence</label>
                      <select value={form.recurrenceOccurrence} onChange={e => set('recurrenceOccurrence', e.target.value)} className="input-field">
                        {Object.entries(OCCURRENCE_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Weekday</label>
                      <select value={form.recurrenceDayOfWeek} onChange={e => set('recurrenceDayOfWeek', e.target.value)} className="input-field">
                        {Object.entries(WEEKDAY_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {form.recurrenceType === 'DAY_OF_MONTH' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day of the month</label>
                    <input
                      type="number"
                      min="-1"
                      max="31"
                      value={form.recurrenceDayOfMonth}
                      onChange={e => set('recurrenceDayOfMonth', e.target.value)}
                      className="input-field"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      1–31 (clamped to the month length) or -1 for the last day.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End after occurrences</label>
                <input
                  type="number"
                  min="1"
                  value={form.occurrenceLimit}
                  onChange={e => set('occurrenceLimit', e.target.value)}
                  placeholder="No limit"
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Stop after this many scheduled occurrences (blank = never).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => set('endDate', e.target.value)}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Stop generating work orders after this date (blank = never).
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Schedule preview:</span>{' '}
                This task will repeat {recurrenceSummary(form.frequency, form.interval, form.recurrenceType, form.recurrenceOccurrence, form.recurrenceDayOfWeek, form.recurrenceDayOfMonth)}.
                {form.occurrenceLimit && <> Ending after {form.occurrenceLimit} occurrence{form.occurrenceLimit !== '1' ? 's' : ''}.</>}
                {form.endDate && <> Ending {form.endDate}.</>}
              </p>
            </div>
          </>
        )}

        {(form.triggerType === 'METER' || form.triggerType === 'TIME_OR_METER') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form.assetId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meter <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.meterId}
                    onChange={e => handleMeterChange(e.target.value)}
                    className="input-field" required
                  >
                    <option value="">— Select meter —</option>
                    {loadingMeters ? (
                      <option disabled>Loading...</option>
                    ) : meters.length === 0 ? (
                      <option disabled>No meters on this asset</option>
                    ) : (
                      meters.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit}){m.isPrimary ? ' ★' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Select the meter that triggers this schedule</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meter unit <span className="text-red-500">*</span>
                  </label>
                  <select value={form.meterUnit}
                    onChange={e => set('meterUnit', e.target.value)}
                    className="input-field" required>
                    <option value="">— Select unit —</option>
                    {METER_UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Select from standard CMMS meter units</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meter threshold <span className="text-red-500">*</span>
                </label>
                <input type="number" step="0.01" value={form.meterInterval}
                  onChange={e => set('meterInterval', e.target.value)}
                  placeholder="e.g. 10000"
                  className="input-field" required />
                <p className="text-xs text-gray-400 mt-1">WO generates when meter reaches this value</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700">
                <span className="font-medium">Meter-based schedule:</span>{' '}
                Work orders will be generated when the meter reading reaches {form.meterInterval || '—'} {form.meterUnit || 'units'}.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Next due date <span className="text-red-500">*</span>
          </label>
          <input type="date" value={form.nextDueDate} onChange={e => set('nextDueDate', e.target.value)}
            className="input-field" required />
          <p className="text-xs text-gray-400 mt-1">
            {form.triggerType === 'METER'
              ? 'Start date for tracking meter-based maintenance. Does not auto-advance.'
              : form.triggerType === 'EVENT'
                ? 'Reference due date for condition/event-based maintenance. Does not auto-advance.'
                : 'After a work order is generated, this date will advance by the frequency interval.'}
          </p>
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive}
              onChange={e => set('isActive', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Schedule is active
            </label>
          </div>
        )}
      </div>

      {/* Schedule Behavior & Horizon */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Schedule Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Behavior</label>
            <select
              value={form.scheduleBehavior}
              onChange={e => set('scheduleBehavior', e.target.value)}
              className="input-field"
            >
              <option value="FIXED">Fixed Intervals</option>
              <option value="FLOATING">Floating Intervals</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {form.scheduleBehavior === 'FIXED'
                ? 'Next WO fires on a fixed cadence regardless of completion.'
                : 'Next WO fires after the previous one is completed + the interval.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduling Horizon</label>
            <input
              type="number"
              min="1"
              max="52"
              value={form.schedulingHorizon}
              onChange={e => set('schedulingHorizon', e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">
              How many WOs to pre-generate at once (1 = one at a time).
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date offset (days before due)</label>
          <input
            type="number"
            min="0"
            max="365"
            value={form.startDateOffset}
            onChange={e => set('startDateOffset', e.target.value)}
            className="input-field"
          />
          <p className="text-xs text-gray-400 mt-1">
            WOs will start this many days before the due date (0 = start on due date).
          </p>
        </div>
      </div>

      {/* Work Order Defaults */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Work Order Defaults</h2>
        <p className="text-xs text-gray-500">
          Default values applied to work orders generated from this schedule.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={form.woPriority}
              onChange={e => set('woPriority', e.target.value)}
              className="input-field"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
            <select
              value={form.woAssignedToId}
              onChange={e => set('woAssignedToId', e.target.value)}
              className="input-field"
            >
              <option value="">— Unassigned —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={form.woTeamId}
                onChange={e => set('woTeamId', e.target.value)}
                className="input-field"
              >
                <option value="">— No team —</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional description</label>
          <textarea
            value={form.woDescription}
            onChange={e => set('woDescription', e.target.value)}
            rows={3}
            placeholder="Optional description appended to generated work orders..."
            className="input-field"
          />
        </div>
      </div>

      {/* Task Template */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-emerald-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Task Template</h2>
          {tasks.length > 0 && (
            <span className="text-xs text-gray-400 font-medium">({tasks.length})</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          These tasks are copied onto every work order generated from this schedule as subtasks.
        </p>

        {tasks.length > 0 && (() => {
          const visibleTasks = showAllTasks ? tasks : tasks.slice(0, VISIBLE_TASKS)
          const hiddenCount = tasks.length - VISIBLE_TASKS
          return (
            <div className="max-h-[32rem] overflow-y-auto -mx-1 px-1 space-y-3">
              {visibleTasks.map((task, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2.5">
                  {/* Row 1: number, title, user, priority, required, actions */}
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 text-center text-xs font-bold text-gray-400">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={task.title}
                      onChange={e => updateTask(idx, 'title', e.target.value)}
                      placeholder="Task title (e.g. Check belt tension)"
                      className="input-field flex-1"
                    />
                    <select
                      value={task.assignedToId}
                      onChange={e => updateTask(idx, 'assignedToId', e.target.value)}
                      className="input-field w-36"
                    >
                      <option value="">— Unassigned —</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <select
                      value={task.priority}
                      onChange={e => updateTask(idx, 'priority', e.target.value)}
                      className="input-field w-28"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                    <label
                      className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none"
                      title={task.required ? 'Required — must be completed to close work orders' : 'Optional — does not block work order completion'}
                    >
                      <input
                        type="checkbox"
                        checked={task.required}
                        onChange={e => updateTask(idx, 'required', e.target.checked)}
                        className="sr-only peer"
                      />
                      <span className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full relative transition-colors peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4"></span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${task.required ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {task.required ? 'Req' : 'Opt'}
                      </span>
                    </label>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => moveTask(idx, -1)} disabled={idx === 0}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => moveTask(idx, 1)} disabled={idx === tasks.length - 1}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeTask(idx)}
                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50" title="Remove task">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Row 2: description + team */}
                  <div className="flex items-start gap-2 pl-8">
                    <textarea
                      value={task.description}
                      onChange={e => updateTask(idx, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      rows={1}
                      className="input-field flex-1 text-xs resize-none"
                    />
                    {teams.length > 0 && (
                      <select
                        value={task.assignedTeamId}
                        onChange={e => updateTask(idx, 'assignedTeamId', e.target.value)}
                        className="input-field w-36 text-xs"
                      >
                        <option value="">— No team —</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
              {!showAllTasks && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllTasks(true)}
                  className="w-full py-2 text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  Show {hiddenCount} more task{hiddenCount !== 1 ? 's' : ''}
                </button>
              )}
              {showAllTasks && tasks.length > VISIBLE_TASKS && (
                <button
                  type="button"
                  onClick={() => setShowAllTasks(false)}
                  className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Show less
                </button>
              )}
            </div>
          )
        })()}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={addTask}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <Plus className="w-4 h-4" />
            Add task
          </button>
          <button
            type="button"
            onClick={() => taskCsvInputRef.current?.click()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
          <button
            type="button"
            onClick={downloadTaskCsvSample}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
          >
            <Download className="w-4 h-4" />
            Sample CSV
          </button>
          <input ref={taskCsvInputRef} type="file" accept=".csv" className="hidden" onChange={handleTaskCsvFile} />
        </div>
        <p className="text-xs text-gray-400">
          CSV columns: title, description, priority (low/medium/high/critical), assigned_to (name or email), assigned_team (name), required (yes/no). Imported tasks are appended to this template.
        </p>
        {importMsg && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">{importMsg}</p>}
      </div>

      {/* Nested PM */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Nested Maintenance</h2>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={nestedEnabled}
              onChange={e => {
                if (e.target.checked && nestedTiers.length === 0) {
                  addNestedTier()
                } else if (!e.target.checked) {
                  setNestedTiers([])
                }
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Run different maintenance tiers at different frequencies (e.g., monthly inspection + quarterly deep clean + annual overhaul).
          The base schedule runs every cycle. Nested tiers fire based on &quot;Run every N WOs&quot;.
        </p>

        {nestedEnabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start cycle at</label>
              <select
                value={form.nestedStartIndex}
                onChange={e => set('nestedStartIndex', e.target.value)}
                className="input-field"
              >
                <option value="0">Base (every cycle)</option>
                {nestedTiers.map((tier, i) => (
                  <option key={i} value={String(i + 1)}>
                    Tier {i + 2}: {tier.label || `Unnamed tier ${i + 2}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Starting point in the nested cycle (useful when setting up mid-cycle).
              </p>
            </div>

            {nestedTiers.map((tier, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                <div className="flex items-center justify-between">
                  <input
                    value={tier.label}
                    placeholder="Tier name (e.g. Quarterly Deep Clean)"
                    onChange={e => updateNestedTier(i, 'label', e.target.value)}
                    className="text-sm font-medium bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-full"
                  />
                  <button type="button" onClick={() => removeNestedTier(i)} className="text-gray-400 hover:text-red-600 ml-2 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500">Every</span>
                  <input
                    type="number"
                    min="1"
                    value={tier.interval}
                    onChange={e => updateNestedTier(i, 'interval', parseInt(e.target.value) || 1)}
                    className="w-16 text-sm rounded border-gray-300"
                  />
                  <select
                    value={tier.frequency}
                    onChange={e => updateNestedTier(i, 'frequency', e.target.value)}
                    className="text-sm rounded border-gray-300"
                  >
                    {freqOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500 ml-2">Run every</span>
                  <input
                    type="number"
                    min="1"
                    value={tier.runEvery}
                    onChange={e => updateNestedTier(i, 'runEvery', parseInt(e.target.value) || 1)}
                    className="w-16 text-sm rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-500">WOs</span>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addNestedTier}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
            >
              <Plus className="w-4 h-4" /> Add tier
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create schedule'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
