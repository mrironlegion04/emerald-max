import bcrypt from 'bcryptjs'

export const MIN_PASSWORD_LENGTH = 12

// A valid bcrypt hash used to equalize response timing when the account does
// not exist or is inactive, preventing user enumeration via timing.
const DUMMY_HASH = '$2b$12$4/QOP46sPsyIfvzZdoFx6eHYazvGyM3P/dwvzr0rpJR14B7RltOkq'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Runs a bcrypt comparison against a dummy hash so that login requests for
 * unknown/inactive users take the same time as real users.
 */
export async function verifyPasswordTimingSafe(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash || DUMMY_HASH)
}
