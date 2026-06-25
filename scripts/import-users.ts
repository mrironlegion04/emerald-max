import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

const CSV_PATH = join(__dirname, 'data', 'maintenance-users-list.csv')
const DEFAULT_PASSWORD = 'pass12!@'

function parseCSV(filePath: string): { code: string; name: string; department: string; plant: string }[] {
  const lines = readFileSync(filePath, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const result: { code: string; name: string; department: string; plant: string }[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length >= 4) {
      result.push({
        code: parts[0].trim(),
        name: parts[1].trim(),
        department: parts[2].trim(),
        plant: parts[3].trim(),
      })
    }
  }
  return result
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
    try {
      await prisma.user.create({
        data: {
          name: u.name,
          email,
          passwordHash,
          role: 'TECHNICIAN',
          department: u.department,
        },
      })
      console.log(`  Created: ${u.code} — ${u.name} (${email})`)
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
