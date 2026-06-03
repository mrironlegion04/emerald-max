import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()


async function main() {
  console.log('🌱 Seeding production database...')

  // ── Admin User ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cmms.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'max_admin@emerald.local',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin user created')

  console.log('\n🎉 Production seed complete!\n')
  console.log('Login credentials:')
  console.log('  Admin: max_admin@emerald.local / admin123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
