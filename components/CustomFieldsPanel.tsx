'use client'

import { useState } from 'react'

interface CustomField {
  name: string
  value: string | number | boolean
  type: 'text' | 'number' | 'date' | 'checkbox'
}

interface Props {
  fields: Record<string, any> | null | undefined
  onChange: (fields: Record<string, any> | null) => void
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Yes/No' },
]

export default function CustomFieldsPanel({ fields, onChange }: Props) {
  const [fieldList, setFieldList] = useState<CustomField[]>(
    fields ? Object.entries(fields).map(([name, value]) => ({
      name,
      value,
      type: typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : 'text',
    })) : []
  )

  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date' | 'checkbox'>('text')
  const [newFieldValue, setNewFieldValue] = useState('')

  function updateField(index: number, key: 'name' | 'value' | 'type', val: any) {
    const updated = [...fieldList]
    updated[index] = { ...updated[index], [key]: val }
    setFieldList(updated)
    
    // Convert to object and notify parent
    const fieldsObj: Record<string, any> = {}
    updated.forEach(f => {
      if (f.type === 'number') fieldsObj[f.name] = Number(f.value)
      else if (f.type === 'checkbox') fieldsObj[f.name] = f.value === true || f.value === 'true'
      else fieldsObj[f.name] = f.value
    })
    onChange(Object.keys(fieldsObj).length > 0 ? fieldsObj : null)
  }

  function removeField(index: number) {
    const updated = fieldList.filter((_, i) => i !== index)
    setFieldList(updated)
    
    const fieldsObj: Record<string, any> = {}
    updated.forEach(f => {
      if (f.type === 'number') fieldsObj[f.name] = Number(f.value)
      else if (f.type === 'checkbox') fieldsObj[f.name] = f.value === true || f.value === 'true'
      else fieldsObj[f.name] = f.value
    })
    onChange(Object.keys(fieldsObj).length > 0 ? fieldsObj : null)
  }

  function addField() {
    if (!newFieldName.trim()) return

    const updated = [...fieldList, {
      name: newFieldName,
      value: newFieldType === 'number' ? 0 : newFieldType === 'checkbox' ? false : newFieldValue,
      type: newFieldType,
    }]
    setFieldList(updated)

    const fieldsObj: Record<string, any> = {}
    updated.forEach(f => {
      if (f.type === 'number') fieldsObj[f.name] = Number(f.value)
      else if (f.type === 'checkbox') fieldsObj[f.name] = f.value === true || f.value === 'true'
      else fieldsObj[f.name] = f.value
    })
    onChange(fieldsObj)

    setNewFieldName('')
    setNewFieldType('text')
    setNewFieldValue('')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 text-sm mb-4">Custom attributes</h2>

      {/* Existing fields */}
      {fieldList.length > 0 && (
        <div className="space-y-3 mb-5 pb-5 border-b border-gray-100">
          {fieldList.map((field, idx) => (
            <div key={idx} className="flex items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Field name
                </label>
                <input
                  type="text"
                  value={field.name}
                  onChange={e => updateField(idx, 'name', e.target.value)}
                  className="input-field text-sm"
                  placeholder="e.g., Warranty Type"
                />
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type
                </label>
                <select
                  value={field.type}
                  onChange={e => updateField(idx, 'type', e.target.value)}
                  className="input-field text-sm"
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Value
                </label>
                {field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 mt-2.5">
                    <input
                      type="checkbox"
                      checked={field.value === true || field.value === 'true'}
                      onChange={e => updateField(idx, 'value', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600">Yes</span>
                  </label>
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    value={typeof field.value === 'boolean' ? '' : field.value}
                    onChange={e => updateField(idx, 'value', e.target.value)}
                    className="input-field text-sm"
                    placeholder="0"
                  />
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    value={typeof field.value === 'boolean' ? '' : field.value}
                    onChange={e => updateField(idx, 'value', e.target.value)}
                    className="input-field text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={typeof field.value === 'boolean' ? '' : field.value}
                    onChange={e => updateField(idx, 'value', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Enter value"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => removeField(idx)}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-red-50 text-red-600 transition-colors flex-shrink-0"
                title="Remove field"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new field */}
      <div className="space-y-3 bg-gray-50 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-700">Add new attribute</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Field name
            </label>
            <input
              type="text"
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              className="input-field text-sm"
              placeholder="e.g., Color, Spare Parts"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Type
            </label>
            <select
              value={newFieldType}
              onChange={e => setNewFieldType(e.target.value as any)}
              className="input-field text-sm"
            >
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {newFieldType !== 'checkbox' && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Value
              </label>
              {newFieldType === 'number' ? (
                <input
                  type="number"
                  value={newFieldValue}
                  onChange={e => setNewFieldValue(e.target.value)}
                  className="input-field text-sm"
                  placeholder="0"
                />
              ) : newFieldType === 'date' ? (
                <input
                  type="date"
                  value={newFieldValue}
                  onChange={e => setNewFieldValue(e.target.value)}
                  className="input-field text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={newFieldValue}
                  onChange={e => setNewFieldValue(e.target.value)}
                  className="input-field text-sm"
                  placeholder="Enter value"
                />
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={addField}
          disabled={!newFieldName.trim()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add attribute
        </button>
      </div>
    </div>
  )
}
