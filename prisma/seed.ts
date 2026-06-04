import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()


async function main() {
  console.log('🌱 Seeding database...')

  // ── Users ───────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12)
  const techHash  = await bcrypt.hash('tech123', 12)
  const mgrHash   = await bcrypt.hash('manager123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cmms.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@cmms.com',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@cmms.com' },
    update: {},
    create: {
      name: 'John Manager',
      email: 'manager@cmms.com',
      passwordHash: mgrHash,
      role: 'MANAGER',
    },
  })

  const tech1 = await prisma.user.upsert({
    where: { email: 'tech1@cmms.com' },
    update: {},
    create: {
      name: 'Alice Technician',
      email: 'tech1@cmms.com',
      passwordHash: techHash,
      role: 'TECHNICIAN',
    },
  })

  const tech2 = await prisma.user.upsert({
    where: { email: 'tech2@cmms.com' },
    update: {},
    create: {
      name: 'Bob Wrench',
      email: 'tech2@cmms.com',
      passwordHash: techHash,
      role: 'TECHNICIAN',
    },
  })

  console.log('✅ Users created')

  // ── Locations ───────────────────────────────────────────────────────────────
  const loc1 = await prisma.location.upsert({
    where: { id: 'loc-building-a' },
    update: {},
    create: { id: 'loc-building-a', name: 'Building A', address: '123 Factory Road' },
  })

  const loc2 = await prisma.location.upsert({
    where: { id: 'loc-building-b' },
    update: {},
    create: { id: 'loc-building-b', name: 'Building B', address: '123 Factory Road' },
  })

  const loc3 = await prisma.location.upsert({
    where: { id: 'loc-warehouse' },
    update: {},
    create: { id: 'loc-warehouse', name: 'Warehouse', address: '456 Storage Lane' },
  })

  console.log('✅ Locations created')

  // ── Asset categories ────────────────────────────────────────────────────────
  const catElectrical = await prisma.assetCategory.upsert({
    where: { id: 'cat-electrical' },
    update: {},
    create: { id: 'cat-electrical', name: 'Electrical' },
  })

  const catMechanical = await prisma.assetCategory.upsert({
    where: { id: 'cat-mechanical' },
    update: {},
    create: { id: 'cat-mechanical', name: 'Mechanical' },
  })

  const catHVAC = await prisma.assetCategory.upsert({
    where: { id: 'cat-hvac' },
    update: {},
    create: { id: 'cat-hvac', name: 'HVAC' },
  })

  const catPlumbing = await prisma.assetCategory.upsert({
    where: { id: 'cat-plumbing' },
    update: {},
    create: { id: 'cat-plumbing', name: 'Plumbing' },
  })

  console.log('✅ Categories created')

  // ── Assets ──────────────────────────────────────────────────────────────────
  const asset1 = await prisma.asset.upsert({
    where: { assetCode: 'AST-001' },
    update: {},
    create: {
      name: 'Air Compressor #1',
      assetCode: 'AST-001',
      description: 'Main production air compressor, 50HP',
      meterUnit: 'Hours',
      currentMeterValue: 12450,
      status: 'ACTIVE',
      serialNumber: 'AC-2021-00123',
      model: 'Atlas Copco GA37',
      manufacturer: 'Atlas Copco',
      purchaseDate: new Date('2021-03-15'),
      purchaseCost: 18000,
      locationId: loc1.id,
      categoryId: catMechanical.id,
    },
  })

  const asset2 = await prisma.asset.upsert({
    where: { assetCode: 'AST-002' },
    update: {},
    create: {
      name: 'HVAC Unit - Building A',
      assetCode: 'AST-002',
      description: 'Rooftop HVAC unit for Building A',
      status: 'ACTIVE',
      serialNumber: 'HVAC-2020-0456',
      model: 'Carrier 48XB',
      manufacturer: 'Carrier',
      purchaseDate: new Date('2020-07-01'),
      purchaseCost: 22000,
      locationId: loc1.id,
      categoryId: catHVAC.id,
    },
  })

  const asset3 = await prisma.asset.upsert({
    where: { assetCode: 'AST-003' },
    update: {},
    create: {
      name: 'CNC Machine #2',
      assetCode: 'AST-003',
      description: '3-axis CNC milling machine',
      meterUnit: 'Cycles',
      currentMeterValue: 87500,
      status: 'UNDER_MAINTENANCE',
      serialNumber: 'CNC-2019-7892',
      model: 'Haas VF-2',
      manufacturer: 'Haas Automation',
      purchaseDate: new Date('2019-11-20'),
      purchaseCost: 65000,
      locationId: loc1.id,
      categoryId: catMechanical.id,
    },
  })

  const asset4 = await prisma.asset.upsert({
    where: { assetCode: 'AST-004' },
    update: {},
    create: {
      name: 'Electrical Panel B-12',
      assetCode: 'AST-004',
      description: 'Main distribution panel, Building B',
      status: 'ACTIVE',
      serialNumber: 'EP-2022-0089',
      model: 'Square D QO',
      manufacturer: 'Schneider Electric',
      purchaseDate: new Date('2022-01-10'),
      purchaseCost: 4500,
      locationId: loc2.id,
      categoryId: catElectrical.id,
    },
  })

  console.log('✅ Assets created')

  // ── Parts ───────────────────────────────────────────────────────────────────
  await prisma.part.upsert({
    where: { partNumber: 'PRT-BELT-01' },
    update: {},
    create: {
      name: 'Drive Belt V-Type',
      partNumber: 'PRT-BELT-01',
      description: 'Standard V-belt for compressors',
      unitCost: 24.50,
      unit: 'pcs',
    },
  })

  await prisma.part.upsert({
    where: { partNumber: 'PRT-FILTER-01' },
    update: {},
    create: {
      name: 'Air Filter Element',
      partNumber: 'PRT-FILTER-01',
      description: 'Replacement filter for HVAC units',
      unitCost: 45.00,
      unit: 'pcs',
    },
  })

  await prisma.part.upsert({
    where: { partNumber: 'PRT-OIL-15W40' },
    update: {},
    create: {
      name: 'Hydraulic Oil 15W-40',
      partNumber: 'PRT-OIL-15W40',
      unitCost: 12.00,
      unit: 'l',
    },
  })

  await prisma.part.upsert({
    where: { partNumber: 'PRT-BEARING-6205' },
    update: {},
    create: {
      name: 'Ball Bearing 6205',
      partNumber: 'PRT-BEARING-6205',
      unitCost: 18.75,
      unit: 'pcs',
    },
  })

  console.log('✅ Parts created')

  // ── Work orders ─────────────────────────────────────────────────────────────
  await prisma.workOrder.upsert({
    where: { woNumber: 'WO-0001' },
    update: {},
    create: {
      woNumber: 'WO-0001',
      title: 'Compressor oil change and filter replacement',
      description: 'Scheduled quarterly oil change for Air Compressor #1. Replace oil filter and check belts.',
      type: 'PREVENTIVE',
      status: 'OPEN',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      assetId: asset1.id,
      assignedToId: tech1.id,
      createdById: admin.id,
    },
  })

  await prisma.workOrder.upsert({
    where: { woNumber: 'WO-0002' },
    update: {},
    create: {
      woNumber: 'WO-0002',
      title: 'CNC machine spindle bearing replacement',
      description: 'Machine is vibrating excessively. Inspect and replace spindle bearings.',
      type: 'BREAKDOWN',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startedAt: new Date(),
      assetId: asset3.id,
      assignedToId: tech2.id,
      createdById: manager.id,
    },
  })

  await prisma.workOrder.upsert({
    where: { woNumber: 'WO-0003' },
    update: {},
    create: {
      woNumber: 'WO-0003',
      title: 'HVAC filter replacement - Building A',
      description: 'Monthly filter change for HVAC unit. Check refrigerant levels.',
      type: 'PREVENTIVE',
      status: 'OPEN',
      priority: 'LOW',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      assetId: asset2.id,
      assignedToId: tech1.id,
      createdById: admin.id,
    },
  })

  await prisma.workOrder.upsert({
    where: { woNumber: 'WO-0004' },
    update: {},
    create: {
      woNumber: 'WO-0004',
      title: 'Electrical panel B-12 tripped breaker investigation',
      description: 'Circuit breaker #7 keeps tripping. Investigate cause and repair.',
      type: 'BREAKDOWN',
      status: 'OPEN',
      priority: 'CRITICAL',
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // already overdue
      assetId: asset4.id,
      assignedToId: tech2.id,
      createdById: manager.id,
    },
  })

  await prisma.workOrder.upsert({
    where: { woNumber: 'WO-0005' },
    update: {},
    create: {
      woNumber: 'WO-0005',
      title: 'Annual compressor inspection',
      description: 'Full annual inspection per manufacturer schedule.',
      type: 'PREDICTIVE',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      laborHours: 4,
      laborCost: 200,
      partsCost: 0,
      assetId: asset1.id,
      assignedToId: tech1.id,
      createdById: admin.id,
    },
  })

  console.log('✅ Work orders created')

  // ── Issue System ──────────────────────────────────────────────────────────────
  const issueSeed = async () => {
    const domains = await Promise.all([
      prisma.maintenanceDomain.upsert({
        where: { name: 'Electrical' },
        update: { description: 'Electrical systems, panels, and components' },
        create: { name: 'Electrical', description: 'Electrical systems, panels, and components' },
      }),
      prisma.maintenanceDomain.upsert({
        where: { name: 'Mechanical' },
        update: { description: 'Mechanical systems, rotating equipment, and drives' },
        create: { name: 'Mechanical', description: 'Mechanical systems, rotating equipment, and drives' },
      }),
      prisma.maintenanceDomain.upsert({
        where: { name: 'HVAC' },
        update: { description: 'Heating, ventilation, and air conditioning' },
        create: { name: 'HVAC', description: 'Heating, ventilation, and air conditioning' },
      }),
      prisma.maintenanceDomain.upsert({
        where: { name: 'Plumbing' },
        update: { description: 'Plumbing fixtures, pipes, and drainage' },
        create: { name: 'Plumbing', description: 'Plumbing fixtures, pipes, and drainage' },
      }),
      prisma.maintenanceDomain.upsert({
        where: { name: 'Structural' },
        update: { description: 'Building structures, roofing, and civil works' },
        create: { name: 'Structural', description: 'Building structures, roofing, and civil works' },
      }),
    ])

    // Link categories to domains
    const catMapping: Record<string, string[]> = {
      'cat-electrical': ['Electrical'],
      'cat-mechanical': ['Mechanical'],
      'cat-hvac':       ['HVAC'],
      'cat-plumbing':   ['Plumbing'],
    }

    for (const [catId, domainNames] of Object.entries(catMapping)) {
      const domainIds = domainNames.map(n => domains.find(d => d.name === n)!.id)
      await prisma.categoryDomain.deleteMany({ where: { categoryId: catId } })
      await prisma.categoryDomain.createMany({
        data: domainIds.map(domainId => ({ categoryId: catId, domainId })),
        skipDuplicates: true,
      })
    }

    // Representative issues per domain (5-7 each, ordered by priority)
    const issueData: { code: string; title: string; severity: string; domainName: string; sortOrder: number }[] = [
      // Electrical
      { code: 'ELE-001', title: 'Power Failure',             severity: 'CRITICAL', domainName: 'Electrical', sortOrder: 1 },
      { code: 'ELE-002', title: 'Breaker Tripped',           severity: 'HIGH',     domainName: 'Electrical', sortOrder: 2 },
      { code: 'ELE-003', title: 'Motor Overload',            severity: 'HIGH',     domainName: 'Electrical', sortOrder: 3 },
      { code: 'ELE-004', title: 'Wiring Fault',              severity: 'MEDIUM',   domainName: 'Electrical', sortOrder: 4 },
      { code: 'ELE-005', title: 'Lighting Failure',          severity: 'LOW',      domainName: 'Electrical', sortOrder: 5 },
      { code: 'ELE-006', title: 'Panel Corrosion',           severity: 'MEDIUM',   domainName: 'Electrical', sortOrder: 6 },

      // Mechanical
      { code: 'MEC-001', title: 'Bearing Failure',           severity: 'HIGH',     domainName: 'Mechanical', sortOrder: 1 },
      { code: 'MEC-002', title: 'Shaft Misalignment',        severity: 'HIGH',     domainName: 'Mechanical', sortOrder: 2 },
      { code: 'MEC-003', title: 'Oil Leak',                  severity: 'MEDIUM',   domainName: 'Mechanical', sortOrder: 3 },
      { code: 'MEC-004', title: 'Belt Wear',                 severity: 'MEDIUM',   domainName: 'Mechanical', sortOrder: 4 },
      { code: 'MEC-005', title: 'Vibration Excessive',       severity: 'MEDIUM',   domainName: 'Mechanical', sortOrder: 5 },
      { code: 'MEC-006', title: 'Coupling Damage',           severity: 'MEDIUM',   domainName: 'Mechanical', sortOrder: 6 },
      { code: 'MEC-007', title: 'Seal Failure',              severity: 'HIGH',     domainName: 'Mechanical', sortOrder: 7 },

      // HVAC
      { code: 'HVAC-001', title: 'Compressor Failure',       severity: 'CRITICAL', domainName: 'HVAC', sortOrder: 1 },
      { code: 'HVAC-002', title: 'Refrigerant Leak',         severity: 'HIGH',     domainName: 'HVAC', sortOrder: 2 },
      { code: 'HVAC-003', title: 'Fan Motor Fault',          severity: 'MEDIUM',   domainName: 'HVAC', sortOrder: 3 },
      { code: 'HVAC-004', title: 'Filter Clogged',           severity: 'LOW',      domainName: 'HVAC', sortOrder: 4 },
      { code: 'HVAC-005', title: 'Thermostat Malfunction',   severity: 'MEDIUM',   domainName: 'HVAC', sortOrder: 5 },
      { code: 'HVAC-006', title: 'Condenser Coil Dirty',     severity: 'LOW',      domainName: 'HVAC', sortOrder: 6 },

      // Plumbing
      { code: 'PLB-001', title: 'Pipe Burst',                severity: 'CRITICAL', domainName: 'Plumbing', sortOrder: 1 },
      { code: 'PLB-002', title: 'Fixture Leak',              severity: 'MEDIUM',   domainName: 'Plumbing', sortOrder: 2 },
      { code: 'PLB-003', title: 'Drain Clog',                severity: 'MEDIUM',   domainName: 'Plumbing', sortOrder: 3 },
      { code: 'PLB-004', title: 'Water Pressure Low',        severity: 'MEDIUM',   domainName: 'Plumbing', sortOrder: 4 },
      { code: 'PLB-005', title: 'Toilet Not Flushing',       severity: 'LOW',      domainName: 'Plumbing', sortOrder: 5 },

      // Structural
      { code: 'STR-001', title: 'Roof Leak',                 severity: 'HIGH',     domainName: 'Structural', sortOrder: 1 },
      { code: 'STR-002', title: 'Crack in Wall',             severity: 'MEDIUM',   domainName: 'Structural', sortOrder: 2 },
      { code: 'STR-003', title: 'Door Malfunction',          severity: 'LOW',      domainName: 'Structural', sortOrder: 3 },
      { code: 'STR-004', title: 'Floor Damage',              severity: 'MEDIUM',   domainName: 'Structural', sortOrder: 4 },

      // Common / Global fallback issues
      { code: 'COM-001', title: 'General Inspection Needed', severity: 'LOW',      domainName: 'Common', sortOrder: 1 },
      { code: 'COM-002', title: 'Scheduled Maintenance',     severity: 'LOW',      domainName: 'Common', sortOrder: 2 },
      { code: 'COM-003', title: 'Operator Report — Not Specified', severity: 'MEDIUM', domainName: 'Common', sortOrder: 3 },
    ]

    let created = 0; let skipped = 0
    for (const item of issueData) {
      const domain = domains.find(d => d.name === item.domainName)
      const isGlobal = item.domainName === 'Common'
      if (!isGlobal && !domain) continue
      try {
        await prisma.issue.upsert({
          where: { code: item.code },
          update: {
            title: item.title,
            severity: item.severity as any,
            sortOrder: item.sortOrder,
            isGlobal,
            isActive: true,
            ...(isGlobal && { domains: { deleteMany: {} } }),
          },
          create: {
            code: item.code,
            title: item.title,
            severity: item.severity as any,
            sortOrder: item.sortOrder,
            isGlobal,
            ...(isGlobal ? {} : { domains: { create: { domainId: domain!.id } } }),
          },
        })
        created++
      } catch { skipped++ }
    }

    console.log(`  → ${created} issues seeded, ${skipped} skipped`)
  }

  await issueSeed()
  console.log('✅ Issue system seeded')

  // ── PM Schedules ─────────────────────────────────────────────────────────────
  await prisma.maintenanceSchedule.create({
    data: {
      title: 'Monthly oil check - Compressor #1',
      description: 'Check oil level and top up if needed',
      frequency: 'MONTHLY',
      interval: 1,
      nextDueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      assetId: asset1.id,
    },
  }).catch(() => {})

  await prisma.maintenanceSchedule.create({
    data: {
      title: 'Quarterly HVAC filter change',
      description: 'Replace all filters and inspect coils',
      frequency: 'QUARTERLY',
      interval: 1,
      nextDueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      assetId: asset2.id,
    },
  }).catch(() => {})

  console.log('✅ PM schedules created')

  // ── Meters ──────────────────────────────────────────────────────────────────
  const meter1 = await prisma.meter.upsert({
    where: { id: 'meter-compressor-1' },
    update: {},
    create: {
      id: 'meter-compressor-1',
      name: 'Air Compressor #1 Runtime',
      meterType: 'RUNTIME',
      unit: 'Hours',
      isPrimary: true,
      lastValue: 12450,
      lastReadingAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      assetId: asset1.id,
    },
  }).catch(() => { throw new Error('Failed to create meter1') })

  const meter2 = await prisma.meter.upsert({
    where: { id: 'meter-cnc-1' },
    update: {},
    create: {
      id: 'meter-cnc-1',
      name: 'CNC Machine #2 Cycle Counter',
      meterType: 'CYCLE',
      unit: 'Cycles',
      isPrimary: true,
      lastValue: 87500,
      lastReadingAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      assetId: asset3.id,
    },
  }).catch(() => { throw new Error('Failed to create meter2') })

  console.log('✅ Meters created')

  // ── Meter Readings ──────────────────────────────────────────────────────────
  const now = Date.now()
  const readingsA = []
  for (let i = 30; i >= 0; i--) {
    readingsA.push({
      value: 12000 + i * 15 + Math.round(Math.random() * 5),
      readingDate: new Date(now - i * 24 * 60 * 60 * 1000),
      source: 'MANUAL' as const,
      status: 'VALID' as const,
      meterId: meter1.id,
      assetId: asset1.id,
      recordedById: admin.id,
    })
  }

  // Add one SUSPECT reading
  readingsA.push({
    value: 12600,
    readingDate: new Date(now - 1 * 60 * 60 * 1000),
    source: 'MANUAL' as const,
    status: 'SUSPECT' as const,
    meterId: meter1.id,
    assetId: asset1.id,
    recordedById: admin.id,
    notes: 'Sudden spike — possible sensor error',
  })

  for (const r of readingsA) {
    await prisma.meterReading.create({ data: r }).catch(() => {})
  }

  const readingsB = []
  for (let i = 20; i >= 0; i--) {
    readingsB.push({
      value: 83000 + i * 210 + Math.round(Math.random() * 20),
      readingDate: new Date(now - i * 24 * 60 * 60 * 1000),
      source: 'MANUAL' as const,
      status: 'VALID' as const,
      meterId: meter2.id,
      assetId: asset3.id,
      recordedById: tech1.id,
    })
  }

  for (const r of readingsB) {
    await prisma.meterReading.create({ data: r }).catch(() => {})
  }

  console.log('✅ Meter readings created')

  // ── Meter-based PM Schedule ──────────────────────────────────────────────────
  await prisma.maintenanceSchedule.create({
    data: {
      title: 'Compressor 500-hr service',
      description: 'Oil change, filter replacement, belt inspection — every 500 runtime hours',
      triggerType: 'METER',
      frequency: 'MONTHLY',
      interval: 1,
      nextDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      assetId: asset1.id,
      meterId: meter1.id,
      meterUnit: 'Hours',
      meterInterval: 500,
      lastTriggeredValue: 12000,
    },
  }).catch(() => {})

  console.log('✅ Meter-based PM schedule created')

  console.log('\n🎉 Seed complete!\n')
  console.log('Login credentials:')
  console.log('  Admin:     admin@cmms.com   / admin123')
  console.log('  Manager:   manager@cmms.com / manager123')
  console.log('  Tech 1:    tech1@cmms.com   / tech123')
  console.log('  Tech 2:    tech2@cmms.com   / tech123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
