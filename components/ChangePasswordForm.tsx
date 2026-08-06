'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 12

export default function ChangePasswordForm() {
  const router = useRouter()
  const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('forcePasswordChange') === '1'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to change password')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password changed successfully')
      if (forced) {
        setTimeout(() => {
          router.replace('/work-orders')
          router.refresh()
        }, 800)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <KeyRound className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900 text-sm">Change Password</h2>
          <p className="text-xs text-gray-600 mt-1">
            Verify your current password to set a new one. If you forgot your password, ask your admin to reset it.
          </p>
        </div>
      </div>

      {forced && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-900">
            You are using a temporary password. Please set a new password before continuing.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Current password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input-field text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="input-field text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="input-field text-sm"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-green-900">{success}</p>
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
