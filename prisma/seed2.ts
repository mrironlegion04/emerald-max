import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()


async function main() {
  console.log('🌱 Seeding production database...')

  // ── Admin User ───────────────────────────────────────────────────────────────
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is required and must be at least 12 characters. ' +
        'Set it in .env (and delete it after the first seed). Example: ' +
        'openssl rand -base64 18'
    )
  }

  const adminHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: 'max_admin@emerald.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'max_admin@emerald.local',
      passwordHash: adminHash,
      role: 'ADMIN',
      // Force a password change on first login, even with the env-provided secret.
      mustChangePassword: true,
    },
  })

  console.log('✅ Admin user created')

  console.log('\n🎉 Production seed complete!\n')
  console.log('Login: max_admin@emerald.local')
  console.log('You will be prompted to set a new password on first login.')
  console.log('\n⚠️  Now delete SEED_ADMIN_PASSWORD from .env to keep it out of the running environment.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
