'use client'

import { useState, useEffect } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'

interface Skill {
  id: string
  name: string
  category?: string
}

interface UserSkill {
  id: string
  userId: string
  skillId: string
  proficiencyLevel: string
  createdAt: Date
  updatedAt: Date
  skill: {
    id: string
    name: string
    category?: string | null
    createdAt: Date
    updatedAt: Date
  }
}

interface UserSkillsManagerProps {
  userId: string
  initialSkills: UserSkill[]
}

const proficiencyOptions = [
  { value: 'BASIC', label: 'Basic' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'EXPERT', label: 'Expert' },
]

export default function UserSkillsManager({ userId, initialSkills }: UserSkillsManagerProps) {
  const [skills, setSkills] = useState<UserSkill[]>(initialSkills)
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [proficiencyLevel, setProficiencyLevel] = useState('INTERMEDIATE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    loadAvailableSkills()
  }, [])

  const loadAvailableSkills = async () => {
    try {
      const res = await fetch('/api/skills')
      if (res.ok) {
        const data = await res.json()
        setAvailableSkills(data)
      }
    } catch (err) {
      console.error('Failed to load skills:', err)
    }
  }

  const getAvailableSkillsForAdd = () => {
    const assignedIds = new Set(skills.map(s => s.skillId))
    return availableSkills.filter(s => !assignedIds.has(s.id))
  }

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSkillId) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${userId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: selectedSkillId,
          proficiencyLevel,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add skill')
      }

      const newSkill = await res.json()
      setSkills([...skills, newSkill])
      setSelectedSkillId('')
      setProficiencyLevel('INTERMEDIATE')
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveSkill = async (userSkillId: string) => {
    if (!confirm('Remove this skill?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}/skills/${userSkillId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to remove skill')
      setSkills(skills.filter(s => s.id !== userSkillId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove skill')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProficiency = async (userSkillId: string, newLevel: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/skills/${userSkillId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proficiencyLevel: newLevel }),
      })

      if (!res.ok) throw new Error('Failed to update proficiency')
      const updated = await res.json()
      setSkills(skills.map(s => (s.id === userSkillId ? updated : s)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update proficiency')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Skills & Competencies</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs gap-1 flex items-center"
        >
          <Plus className="w-3 h-3" />
          Add skill
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Add skill form */}
      {showAddForm && (
        <form onSubmit={handleAddSkill} className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Skill</label>
            <select
              value={selectedSkillId}
              onChange={e => setSelectedSkillId(e.target.value)}
              className="input-field text-xs"
              required
            >
              <option value="">Select a skill...</option>
              {getAvailableSkillsForAdd().map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.category ? `(${s.category})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Proficiency level</label>
            <select value={proficiencyLevel} onChange={e => setProficiencyLevel(e.target.value)} className="input-field text-xs">
              {proficiencyOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading || !selectedSkillId} className="btn-primary text-xs flex-1">
              {loading ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setSelectedSkillId('')
                setProficiencyLevel('INTERMEDIATE')
              }}
              className="btn-secondary text-xs flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Skills list */}
      {skills.length > 0 ? (
        <div className="space-y-2">
          {skills.map(skill => (
            <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{skill.skill.name}</p>
                {skill.skill.category && <p className="text-xs text-gray-500">{skill.skill.category}</p>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={skill.proficiencyLevel}
                  onChange={e => handleUpdateProficiency(skill.id, e.target.value)}
                  className="input-field text-xs px-2 py-1"
                >
                  {proficiencyOptions.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleRemoveSkill(skill.id)}
                  className="p-1 hover:bg-red-100 rounded-lg transition text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">No skills added yet</p>
      )}
    </div>
  )
}
