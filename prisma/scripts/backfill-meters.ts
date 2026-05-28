import 'dotenv/config'
import { PrismaClient, MeterType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Backfilling meter data from legacy Asset fields...\n')

  // Step 1: Create Meter records for assets that have meterUnit set
  const assetsWithMeters = await prisma.asset.findMany({
    where: { meterUnit: { not: null }, deletedAt: null },
    include: { _count: { select: { meters: true } } },
  })

  let createdMeters = 0
  for (const asset of assetsWithMeters) {
    if (asset._count.meters > 0) {
      console.log(`  Skipping ${asset.assetCode} (${asset.name}) — already has ${asset._count.meters} meter(s)`)
      continue
    }

    const meterType = unitToType(asset.meterUnit ?? '')
    const meter = await prisma.meter.create({
      data: {
        name: `${asset.name} Meter`,
        meterType,
        unit: asset.meterUnit!,
        isPrimary: true,
        lastValue: asset.currentMeterValue ?? null,
        assetId: asset.id,
      },
    })
    console.log(`  Created meter "${meter.name}" (${meter.unit}) for ${asset.assetCode}`)

    // Step 2: Link existing MeterReading records to this meter
    const readingsResult = await prisma.meterReading.updateMany({
      where: { assetId: asset.id } as any,
      data: { meterId: meter.id },
    })
    if (readingsResult.count > 0) {
      console.log(`    -> Linked ${readingsResult.count} existing reading(s)`)
    }

    // Step 3: Update Meter.lastValue with the most recent reading
    const latest = await prisma.meterReading.findFirst({
      where: { meterId: meter.id },
      orderBy: { readingDate: 'desc' },
      select: { value: true, readingDate: true },
    })
    if (latest) {
      await prisma.meter.update({
        where: { id: meter.id },
        data: { lastValue: latest.value, lastReadingAt: latest.readingDate },
      })
    }

    createdMeters++
  }

  // Step 4: Link MaintenanceSchedule records that have meterUnit but no meterId
  const schedulesToLink = await prisma.maintenanceSchedule.findMany({
    where: { triggerType: 'METER', meterId: null, assetId: { not: null } },
  })

  for (const sched of schedulesToLink) {
    const meter = await prisma.meter.findFirst({
      where: { assetId: sched.assetId!, unit: sched.meterUnit ?? undefined, deletedAt: null },
      orderBy: { isPrimary: 'desc' },
    })
    if (meter) {
      await prisma.maintenanceSchedule.update({
        where: { id: sched.id },
        data: { meterId: meter.id, lastTriggeredValue: sched.meterInterval ?? null },
      })
      console.log(`  Linked schedule "${sched.title}" -> meter "${meter.name}"`)
    } else {
      // Fallback: find any meter on the same asset
      const fallbackMeter = await prisma.meter.findFirst({
        where: { assetId: sched.assetId!, deletedAt: null },
        orderBy: { isPrimary: 'desc' },
      })
      if (fallbackMeter) {
        await prisma.maintenanceSchedule.update({
          where: { id: sched.id },
          data: { meterId: fallbackMeter.id, lastTriggeredValue: sched.meterInterval ?? null },
        })
        console.log(`  Linked schedule "${sched.title}" -> meter "${fallbackMeter.name}" (fallback)`)
      } else {
        console.warn(`  WARNING: No meters found for asset ${sched.assetId}, schedule "${sched.title}" left unlinked`)
      }
    }
  }

  console.log(`\nDone. Created ${createdMeters} meter(s).`)
}

function unitToType(unit: string): MeterType {
  const u = unit.toLowerCase()
  if (/hour|runtime/i.test(u)) return 'RUNTIME'
  if (/mile|kilometer|meter|feet|distance/i.test(u)) return 'DISTANCE'
  if (/cycle|revolution|operation|start|count/i.test(u)) return 'CYCLE'
  if (/temp|fahrenheit|celsius|°[fc]/i.test(u)) return 'TEMPERATURE'
  if (/psi|bar|kpa|pressure/i.test(u)) return 'PRESSURE'
  return 'CUSTOM'
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
