import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function parseIssues(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

async function getOrCreateDomain(name: string) {
  let domain = await prisma.maintenanceDomain.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (!domain) {
    domain = await prisma.maintenanceDomain.create({ data: { name } })
    console.log(`  Created domain: "${name}"`)
  }
  return domain
}

async function getNextCode(prefix: string): Promise<number> {
  const existing = await prisma.issue.findMany({
    where: { code: { startsWith: prefix + '-' } },
    select: { code: true },
  })
  let max = 0
  for (const { code } of existing) {
    const match = code.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'))
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > max) max = num
    }
  }
  return max + 1
}

async function main() {
  const dataDir = join(__dirname, 'data')

  const files: { path: string; domainName: string; codePrefix: string; label: string }[] = [
    { path: join(dataDir, 'issues-electrical.txt'), domainName: 'Electrical', codePrefix: 'ELE', label: 'Electrical' },
    { path: join(dataDir, 'issues-mechanical.txt'), domainName: 'Mechanical', codePrefix: 'MEC', label: 'Mechanical' },
  ]

  for (const f of files) {
    if (!existsSync(f.path)) {
      console.error(`File not found: ${f.path}`)
      return
    }
  }

  console.log('Ensuring domains exist...')
  const domains = await Promise.all(files.map(f => getOrCreateDomain(f.domainName)))
  const domainMap = new Map(files.map((f, i) => [f.domainName, domains[i]]))

  let totalCreated = 0
  let totalSkipped = 0

  for (const file of files) {
    const titles = parseIssues(file.path)
    const domain = domainMap.get(file.domainName)!
    let nextNum = await getNextCode(file.codePrefix)
    let created = 0
    let skipped = 0

    console.log(`\nImporting ${titles.length} ${file.label} issues...`)

    for (const title of titles) {
      const code = `${file.codePrefix}-${String(nextNum).padStart(3, '0')}`
      const order = nextNum
      nextNum++

      try {
        await prisma.issue.create({
          data: {
            code,
            title,
            severity: 'MEDIUM',
            sortOrder: order,
            domains: { create: { domainId: domain.id } },
          },
        })
        created++
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.error(`  Skipped (duplicate code "${code}"): ${title}`)
        } else {
          console.error(`  Error: ${e.message}`)
        }
        skipped++
      }
    }

    console.log(`  → ${created} created, ${skipped} skipped`)
    totalCreated += created
    totalSkipped += skipped
  }

  console.log(`\nDone. ${totalCreated} total issues created, ${totalSkipped} skipped.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
