// Shared environment validation.
// Edge-runtime safe (no Node-only APIs) so it can be imported from middleware.

const PLACEHOLDER_PATTERNS = [
  /change-this/,
  /your-random/,
  /secret-32chars/,
  /changeme/i,
  /change-me/i,
  /your-secret/,
  /to-be-filled/,
  /<fill/i,
]

export function isPlaceholderSecret(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value))
}

/**
 * Returns the session signing secret, failing fast if it is missing,
 * too short, or still a placeholder value. A known placeholder secret
 * would allow anyone to forge sessions.
 */
export function getSessionSecret(): string {
  const v = process.env.SESSION_SECRET
  if (!v || v.length < 32 || isPlaceholderSecret(v)) {
    throw new Error(
      'SESSION_SECRET must be set to a unique random string of at least 32 characters. ' +
        'Generate one with: openssl rand -hex 32'
    )
  }
  return v
}

/**
 * Returns the public base URL used for generated links (QR codes, emails,
 * push notifications, presigned URLs). Required in production — falling back
 * to localhost silently would ship broken links.
 */
export function getPublicBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.NODE_ENV === 'production') {
    if (!v || /localhost|127\.0\.0\.1/.test(v)) {
      throw new Error(
        'NEXT_PUBLIC_BASE_URL must be set to the real production URL (e.g. https://cmms.example.com)'
      )
    }
  }
  return v || 'http://localhost:3000'
}

/**
 * Returns the cron bearer secret, failing fast if it is missing or a placeholder.
 * This token guards the PM-generation and notification-digest endpoints.
 */
export function getCronSecret(): string {
  const v = process.env.CRON_SECRET
  if (!v || v.length < 16 || isPlaceholderSecret(v)) {
    throw new Error(
      'CRON_SECRET must be set to a random string of at least 16 characters. ' +
        'Generate one with: openssl rand -hex 16'
    )
  }
  return v
}
