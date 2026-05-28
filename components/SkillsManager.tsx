'use client'

import { useState } from 'react'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

interface Skill {
  id: string
  name: string
  category?: string | null
  _count?: {
    userSkills: number
  }
}

interface SkillsManagerProps {
  initialSkills: Skill[]
}

export default function SkillsManager({ initialSkills }: SkillsManagerProps) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills)
  const [showForm, setShowForm] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!skillName.trim()) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: skillName.trim(),
          category: category.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add skill')
      }

      const newSkill = await res.json()
      setSkills([...skills, { ...newSkill, _count: { userSkills: 0 } }])
      setSkillName('')
      setCategory('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('Delete this skill? Users with this skill will not be affected.')) return

    try {
      const res = await fetch(`/api/skills/${skillId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete skill')
      setSkills(skills.filter(s => s.id !== skillId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill')
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Add Skill Form */}
      {showForm ? (
        <form
          onSubmit={handleAddSkill}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h3 className="font-semibold text-gray-900">Add New Skill</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={skillName}
              onChange={e => setSkillName(e.target.value)}
              className="input-field"
              placeholder="e.g., Electrical Repair, Plumbing, Welding"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="input-field"
              placeholder="e.g., Mechanical, Electrical, Structural"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading || !skillName.trim()} className="btn-primary flex-1">
              {loading ? 'Adding...' : 'Add Skill'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setSkillName('')
                setCategory('')
              }}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Skill
        </button>
      )}

      {/* Skills List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Skills Catalog</h3>
          <p className="text-xs text-gray-500 mt-1">{skills.length} skill{skills.length !== 1 ? 's' : ''} defined</p>
        </div>

        {skills.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {skills.map(skill => (
              <div key={skill.id} className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{skill.name}</p>
                  {skill.category && <p className="text-xs text-gray-500 mt-1">{skill.category}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Users assigned</p>
                    <p className="text-lg font-bold text-blue-600">{skill._count?.userSkills ?? 0}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteSkill(skill.id)}
                    disabled={(skill._count?.userSkills ?? 0) > 0}
                    title={(skill._count?.userSkills ?? 0) > 0 ? 'Cannot delete: users have this skill' : 'Delete skill'}
                    className={`p-2 rounded-lg transition ${
                      (skill._count?.userSkills ?? 0) > 0
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-red-100 text-red-600'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No skills yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
