'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import UserSkillsManager from './UserSkillsManager'
import { AlertCircle, Shield, CheckCircle, X } from 'lucide-react'

interface UserFormData {
  name: string
  email: string
  password: string
  role: string
  isActive: boolean
  phone: string
  bio: string
  department: string
  domainId: string
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

interface Props {
  initialData?: Partial<UserFormData> & {
    id?: string
    userSkills?: UserSkill[]
    hasFaceVerification?: boolean
    lastFaceVerifyAt?: Date | null
    facePhotoUrl?: string
  }
  userId?: string
}

const roleOptions = [
  { value: 'ADMIN', label: 'Admin — full access' },
  { value: 'MANAGER', label: 'Manager — create/edit, no delete' },
  { value: 'TECHNICIAN', label: 'Technician — view + update WOs' },
]

export default function UserForm({ initialData, userId }: Props) {
  const router = useRouter()
  const isEdit = !!userId

  const [domains, setDomains] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/domains')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDomains(data)
        }
      })
      .catch(err => console.error('Error fetching domains', err))
  }, [])

  const [form, setForm] = useState<UserFormData>({
    name: initialData?.name ?? '',
    email: initialData?.email ?? '',
    password: '',
    role: initialData?.role ?? 'TECHNICIAN',
    isActive: initialData?.isActive ?? true,
    phone: (initialData as any)?.phone ?? '',
    bio: (initialData as any)?.bio ?? '',
    department: (initialData as any)?.department ?? '',
    domainId: (initialData as any)?.domainId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [managingFace, setManagingFace] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [faceStatus, setFaceStatus] = useState({
    hasFaceVerification: (initialData as any)?.hasFaceVerification || false,
    lastFaceVerifyAt: (initialData as any)?.lastFaceVerifyAt || null,
    facePhotoUrl: (initialData as any)?.facePhotoUrl || null,
  })

  function set(field: keyof UserFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        isActive: form.isActive,
        phone: form.phone || null,
        bio: form.bio || null,
        department: form.department || null,
        domainId: form.domainId || null,
      }
      if (form.password) payload.password = form.password

      const url = isEdit ? `/api/users/${userId}` : '/api/users'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.push('/users')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleEnableFaceVerification = async () => {
    if (!userId) return
    setManagingFace(true)
    try {
      const res = await fetch(`/api/users/${userId}/face-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enable')
      }

      const data = await res.json()
      setFaceStatus({ hasFaceVerification: true, lastFaceVerifyAt: data.lastFaceVerifyAt, facePhotoUrl: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable face verification')
    } finally {
      setManagingFace(false)
    }
  }

  const handleDisableFaceVerification = async () => {
    if (!userId || !confirm('Disable facial biometric verification for this user?')) return
    setManagingFace(true)
    try {
      const res = await fetch(`/api/users/${userId}/face-verification`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to disable')
      }

      setFaceStatus({ hasFaceVerification: false, lastFaceVerifyAt: null, facePhotoUrl: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable face verification')
    } finally {
      setManagingFace(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!userId) return
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/users/${userId}/face-verification/photo`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        console.log('Upload error response:', data) // Debug logging
        
        // Handle duplicate face error - fetch user name
        if (res.status === 409 && data.details && data.details.existing_user_id) {
          const existingUserId = data.details.existing_user_id
          const similarity = data.details.similarity || '?'
          
          console.log('Fetching user:', existingUserId) // Debug logging
          
          try {
            const userRes = await fetch(`/api/users/${existingUserId}`)
            console.log('User fetch status:', userRes.status) // Debug logging
            
            if (userRes.ok) {
              const userData = await userRes.json()
              console.log('User data:', userData) // Debug logging
              throw new Error(`Face already enrolled by "${userData.name}" (Similarity: ${similarity}%)`)
            } else {
              console.log('User fetch failed:', userRes.status) // Debug logging
              throw new Error(`Face already enrolled by another user (ID: ${existingUserId}, Similarity: ${similarity}%)`)
            }
          } catch (userFetchErr) {
            console.log('User fetch error:', userFetchErr) // Debug logging
            // Check if it's our error message
            if (userFetchErr instanceof Error && userFetchErr.message.includes('Face already enrolled by')) {
              throw userFetchErr // Re-throw our custom message
            }
            throw new Error(`Face already enrolled by another user (ID: ${existingUserId}, Similarity: ${similarity}%)`)
          }
        }
        
        throw new Error(data.error || 'Failed to upload photo')
      }

      const data = await res.json()
      setFaceStatus(prev => ({ ...prev, facePhotoUrl: data.facePhotoUrl }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload face photo'
      console.error('Photo upload final error:', errorMsg) // Debug logging
      setPhotoError(errorMsg)
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!userId || !confirm('Remove the facial biometric photo?')) return
    setPhotoUploading(true)
    try {
      const res = await fetch(`/api/users/${userId}/face-verification/photo`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove photo')
      }

      setFaceStatus(prev => ({ ...prev, facePhotoUrl: null }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove face photo')
    } finally {
      setPhotoUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Basic Information</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="input-field"
            placeholder="John Smith"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="input-field"
            placeholder="john@company.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            className="input-field"
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>

      {/* Profile Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Profile Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <input
            type="text"
            value={form.department}
            onChange={e => set('department', e.target.value)}
            className="input-field"
            placeholder="Maintenance, Operations, etc."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maintenance Domain (Engineering Group)
          </label>
          <select
            value={form.domainId}
            onChange={e => set('domainId', e.target.value)}
            className="input-field cursor-pointer"
          >
            <option value="">No Assigned Domain</option>
            {domains.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <textarea
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            className="input-field resize-none"
            rows={3}
            placeholder="Brief professional bio..."
          />
        </div>
      </div>

      {/* Security & Role */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Security & Access</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
            {!isEdit && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            className="input-field"
            placeholder="••••••••"
            required={!isEdit}
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)} className="input-field">
            {roleOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {isEdit && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => set('isActive', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              User is active
            </label>
          </div>
        )}
      </div>

      {/* Skills (edit only) */}
      {isEdit && userId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <UserSkillsManager userId={userId} initialSkills={(initialData as any)?.userSkills ?? []} />
        </div>
      )}

      {/* Face Verification (edit only - Admin/Manager Control) */}
      {isEdit && userId && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 bg-blue-50">
          <div className="flex items-start gap-3 mb-4">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm">Biometric Security Management</h3>
              <p className="text-xs text-gray-600 mt-1">Control facial biometric enrollment for this user</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 space-y-4">
            {/* Status Card */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                {faceStatus.hasFaceVerification ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <X className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {faceStatus.hasFaceVerification ? 'Enrolled' : 'Not enrolled'}
                  </p>
                  {faceStatus.lastFaceVerifyAt && (
                    <p className="text-xs text-gray-600">
                      Last verified: {new Date(faceStatus.lastFaceVerifyAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  faceStatus.hasFaceVerification
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {faceStatus.hasFaceVerification ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!faceStatus.hasFaceVerification ? (
                <button
                  type="button"
                  onClick={handleEnableFaceVerification}
                  disabled={managingFace}
                  className="flex-1 btn-primary text-sm"
                >
                  {managingFace ? 'Enabling...' : 'Enable Face Verification'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisableFaceVerification}
                  disabled={managingFace}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded-lg transition text-sm disabled:opacity-50"
                >
                  {managingFace ? 'Disabling...' : 'Disable Face Verification'}
                </button>
              )}
            </div>

            {/* Photo Management (only when enabled) */}
            {faceStatus.hasFaceVerification && (
              <div className="pt-4 border-t border-blue-200 space-y-3">
                <p className="text-xs font-medium text-gray-700">Facial Biometric Photo</p>
                
                {/* Photo Display */}
                {faceStatus.facePhotoUrl && (
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <img
                      src={faceStatus.facePhotoUrl}
                      alt="Face verification"
                      className="w-16 h-16 object-cover rounded-lg border border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600">Current biometric photo stored</p>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={photoUploading}
                        className="text-xs text-red-600 hover:text-red-800 font-medium mt-1"
                      >
                        {photoUploading ? 'Removing...' : 'Remove photo'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Photo Upload */}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handlePhotoUpload(file)
                    }}
                    disabled={photoUploading}
                    className="hidden"
                  />
                  <div className="cursor-pointer bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-300 rounded-lg p-3 text-center transition disabled:opacity-50">
                    <p className="text-xs font-medium text-blue-700">
                      {photoUploading ? 'Uploading photo...' : faceStatus.facePhotoUrl ? 'Change photo' : 'Add facial biometric photo'}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">Click to select image</p>
                  </div>
                </label>

                {/* Photo Upload Error */}
                {photoError && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">{photoError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotoError('')}
                      className="text-red-600 hover:text-red-800 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-600 pt-2">
              Admin/Manager controlled. Upload facial photo, then user can verify during work order completion.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create user'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}
