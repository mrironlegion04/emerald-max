import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

const CSV_PATH = join(__dirname, 'data', 'maintenance-users-list.csv')
const DEFAULT_PASSWORD = 'pass12!@'

const ROLE_MAP: Record<string, 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'REQUESTER' | 'VIEWER'> = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  TECHNICIAN: 'TECHNICIAN',
  REQUESTER: 'REQUESTER',
  VIEWER: 'VIEWER',
}

interface CsvUser {
  code: string
  name: string
  department: string
  role: string
  phone: string
  team: string
}

function parseCSV(filePath: string): CsvUser[] {
  const lines = readFileSync(filePath, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const result: CsvUser[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length >= 4) {
      result.push({
        code: parts[0].trim(),
        name: parts[1].trim(),
        department: parts[2].trim(),
        role: parts[3].trim(),
        phone: (parts[4] ?? '').trim(),
        team: (parts[5] ?? '').trim(),
      })
    }
  }
  return result
}

async function getOrCreateTeam(name: string) {
  let team = await prisma.team.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (!team) {
    team = await prisma.team.create({ data: { name, trade: name } })
    console.log(`  Created team: "${name}"`)
  }
  return team
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`File not found: ${CSV_PATH}`)
    process.exit(1)
  }

  const users = parseCSV(CSV_PATH)
  if (users.length === 0) {
    console.log('No users found in CSV')
    return
  }

  console.log(`Importing ${users.length} users...`)
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)

  let created = 0
  let skipped = 0

  for (const u of users) {
    const email = `${u.code}@emerald.local`
    const role = ROLE_MAP[u.role.toUpperCase()] ?? 'TECHNICIAN'
    try {
      let team: { id: string } | null = null
      if (u.team) {
        team = await getOrCreateTeam(u.team)
      }
      await prisma.user.create({
        data: {
          name: u.name,
          email,
          username: u.code,
          passwordHash,
          role,
          department: u.department || null,
          phone: u.phone || null,
          ...(team
            ? {
                teamMemberships: { create: [{ teamId: team.id, role: 'MEMBER' }] },
                teamScopes: { create: [{ teamId: team.id }] },
              }
            : {}),
        },
      })
      console.log(`  Created: ${u.code} — ${u.name} (${email}) [${role}]${team ? ` → team ${u.team}` : ''}`)
      created++
    } catch (e: any) {
      if (e.code === 'P2002') {
        console.log(`  Skipped (duplicate email "${email}"): ${u.name}`)
      } else {
        console.error(`  Error creating ${u.code}: ${e.message}`)
      }
      skipped++
    }
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`)
  console.log(`Default password: ${DEFAULT_PASSWORD}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
