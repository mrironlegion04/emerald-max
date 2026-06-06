'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Phone, Briefcase, FileText, CheckCircle, X } from 'lucide-react'

interface UserData {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  phone?: string
  bio?: string
  department?: string
  domain?: { id: string; name: string } | null
  hasFaceVerification: boolean
  facePhotoUrl?: string
  lastFaceVerifyAt?: Date | null
  userSkills?: Array<{
    skill: { id: string; name: string; category?: string | null }
    proficiencyLevel: string
  }>
}

interface UserDisplayProps {
  user: UserData
  userId: string
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  TECHNICIAN: 'bg-green-100 text-green-800',
}

const proficiencyColors: Record<string, string> = {
  BASIC: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  INTERMEDIATE: 'bg-blue-50 text-blue-700 border border-blue-200',
  EXPERT: 'bg-green-50 text-green-700 border border-green-200',
}

export default function UserDisplay({ user, userId }: UserDisplayProps) {
  const router = useRouter()
  const [removingPhoto, setRemovingPhoto] = useState(false)

  const handleRemovePhoto = async () => {
    if (!confirm('Remove this user\'s facial biometric photo?')) return
    setRemovingPhoto(true)
    try {
      const res = await fetch(`/api/users/${userId}/face-verification/photo`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove photo')
      router.refresh()
    } catch (error) {
      alert('Failed to remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header with Edit Button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-gray-600 mt-1">{user.email}</p>
        </div>
        <Link
          href={`/users/${userId}/edit`}
          className="btn-primary"
        >
          Edit user
        </Link>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Role */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium">Role</p>
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user.role]}`}>
              {user.role}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium">Status</p>
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Department */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium">Department</p>
          <p className="text-sm font-medium text-gray-900 mt-2">{user.department || '—'}</p>
        </div>

        {/* Maintenance Domain */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium">Maintenance Domain</p>
          <p className="text-sm font-medium text-gray-900 mt-2">{user.domain?.name || '—'}</p>
        </div>

        {/* Face Verification */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-medium">Biometric</p>
          <div className="mt-2 flex items-center gap-2">
            {user.hasFaceVerification ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Active</span>
              </>
            ) : (
              <>
                <X className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-700">Inactive</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Contact Information</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-600">Email</p>
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
            </div>
          </div>
          {user.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600">Phone</p>
                <p className="text-sm font-medium text-gray-900">{user.phone}</p>
              </div>
            </div>
          )}
          {user.department && (
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600">Department</p>
                <p className="text-sm font-medium text-gray-900">{user.department}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Bio</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{user.bio}</p>
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      {user.userSkills && user.userSkills.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Skills & Competencies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {user.userSkills.map((us) => (
              <div
                key={us.skill.id}
                className={`rounded-lg p-3 ${proficiencyColors[us.proficiencyLevel] || proficiencyColors.INTERMEDIATE}`}
              >
                <p className="font-medium text-sm">{us.skill.name}</p>
                {us.skill.category && <p className="text-xs opacity-75 mt-0.5">{us.skill.category}</p>}
                <p className="text-xs font-semibold mt-1">{us.proficiencyLevel}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Biometric Security */}
      {user.hasFaceVerification && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 bg-blue-50">
          <div className="flex items-start gap-3 mb-4">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Biometric Security</h3>
              <p className="text-xs text-gray-600 mt-1">Facial biometric enrollment for identity verification</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Status</p>
                {user.lastFaceVerifyAt && (
                  <p className="text-xs text-gray-600 mt-1">
                    Last verified: {new Date(user.lastFaceVerifyAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                Active
              </span>
            </div>

            {/* Photo Display */}
            {user.facePhotoUrl && (
              <div className="flex items-center gap-4">
                <img
                  src={user.facePhotoUrl}
                  alt="Face biometric"
                  className="w-24 h-24 object-cover rounded-lg border-2 border-blue-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Facial biometric photo</p>
                  <p className="text-xs text-gray-600 mt-1">Photo stored for identity verification</p>
                  <Link
                    href={`/users/${userId}/edit`}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-2 inline-block"
                  >
                    → Manage in edit mode
                  </Link>
                </div>
              </div>
            )}

            {!user.facePhotoUrl && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">No facial biometric photo uploaded yet</p>
                <Link
                  href={`/users/${userId}/edit`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-2 inline-block"
                >
                  → Upload in edit mode
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Back Link */}
      <div className="pt-4 border-t border-gray-200">
        <Link href="/users" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
          ← Back to users
        </Link>
      </div>
    </div>
  )
}
