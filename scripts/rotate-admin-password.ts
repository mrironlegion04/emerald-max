import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'

/**
 * Rotates the password of an admin account and forces re-authentication.
 *
 * New password is taken (in priority order) from:
 *   1. the first CLI argument
 *   2. the ADMIN_PASSWORD environment variable
 *   3. a freshly generated random password (printed to stdout once)
 *
 * The admin account defaults to ADMIN_EMAIL env or `admin@cmms.com`.
 * Existing sessions are invalidated by bumping `sessionVersion`.
 *
 * Usage:
 *   npm run rotate-admin-password                    # generates a random password
 *   ADMIN_PASSWORD='...' npm run rotate-admin-password
 *   npm run rotate-admin-password -- 'new-password'
 */

const MIN_LENGTH = 12

function readPassword(): string {
  const arg = process.argv[2]
  if (arg) return arg
  const fromEnv = process.env.ADMIN_PASSWORD
  if (fromEnv) return fromEnv
  return randomBytes(18).toString('base64url') // 24 chars, URL-safe
}

function main(): void {
  const password = readPassword()
  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`)
    process.exit(1)
  }

  const email = process.env.ADMIN_EMAIL ?? 'admin@cmms.com'
  const prisma = new PrismaClient()

  prisma.user
    .findUnique({ where: { email } })
    .then((user) => user ?? prisma.user.findFirst({ where: { role: 'ADMIN' } }))
    .then((admin) => {
      if (!admin) {
        console.error(`No admin account found (looked for email ${email} or role ADMIN).`)
        process.exitCode = 1
        return
      }
      return bcrypt
        .hash(password, 12)
        .then((hash) =>
          prisma.user.update({
            where: { id: admin.id },
            data: {
              passwordHash: hash,
              mustChangePassword: true,
              sessionVersion: { increment: 1 },
            },
          })
        )
        .then(() => {
          console.log(`Rotated password for ${admin.email}.`)
          console.log('Account forced to change password on next login; sessions invalidated.')
          const provided = !!process.argv[2] || !!process.env.ADMIN_PASSWORD
          if (!provided) {
            console.log(`New password: ${password}`)
          }
        })
    })
    .catch((err: unknown) => {
      console.error('Rotation failed:', err)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}

main()
