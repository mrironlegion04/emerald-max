import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { generateWONumber } from '@/lib/wo-number'
import { canAssignUsers, canWriteToAssets, canWriteToLocations } from '@/lib/access-control'
import { parseCSV, parseCSVExact } from '@/lib/csv'
import { hashPassword } from '@/lib/auth'
import { randomBytes } from 'crypto'

const VALID_CRITICALITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

// Random, high-entropy temporary password for imported owner accounts.
function generateTempPassword(): string {
  return randomBytes(12).toString('base64url')
}

function getField(row: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = row[n]
    if (v !== undefined && v !== null) return (v as string).trim()
  }
  return ''
}

function engineeringDomains(name: string): string[] {
  const n = name.trim()
  if (!n) return []
  const normalized = n.toLowerCase() === 'mech' ? 'Mechanical' : n
  const SPLIT: Record<string, string[]> = {
    'Mech-Elec': ['Mechanical', 'Electrical'],
    'Hyd-Elec':  ['Hydraulic', 'Electrical'],
  }
  return SPLIT[normalized] ?? [normalized]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
}

function toOwnerEmail(name: string): string {
  return `${slugify(name)}@cmms.com`
}

// ── Locations (MaintWiz Facility-List) ────────────────────────────────────────
async function handleLocationsImport(text: string, user: ImportUser, dryRun: boolean) {
  const rows = parseCSVExact(text)
  const validRows = rows.filter(r => getField(r, 'Facility Code'))
  const results = { created: 0, skipped: 0, errors: [] as string[] }

  const idByName = new Map<string, string>()
  const pathByName = new Map<string, string>()
  const seenCodes = new Set<string>()

  const allCodes = [...new Set(validRows.map(r => getField(r, 'Facility Code')).filter(Boolean))]
  const existingLocations = await prisma.location.findMany({
    where: { code: { in: allCodes } },
    select: { code: true, name: true, id: true, path: true },
  })
  const existingByCode = new Map(existingLocations.map(l => [l.code!, l]))
  const existingByName = new Map<string, { id: string; path: string | null }>()
  for (const l of existingLocations) {
    if (!existingByName.has(l.name.toLowerCase())) existingByName.set(l.name.toLowerCase(), { id: l.id, path: l.path })
  }

  const createLocation = async (r: Record<string, string>) => {
    const code = getField(r, 'Facility Code')
    const name = getField(r, 'Facility Name') || code
    const parentName = getField(r, 'Part of Facility')

    // Resolve parent: a location created earlier in this run, else an existing DB location
    let parentId: string | null = null
    let parentPath: string | undefined
    if (parentName) {
      const inProgress = idByName.get(parentName)
      const existing = existingByName.get(parentName.toLowerCase())
      if (inProgress && !inProgress.startsWith('dry:')) {
        parentId = inProgress
        parentPath = pathByName.get(parentName)
      } else if (existing) {
        parentId = existing.id
        parentPath = existing.path ?? undefined
      }
    }
    const path = parentPath ? `${parentPath} › ${name}` : name

    if (seenCodes.has(code)) {
      results.errors.push(`Location code "${code}" appears more than once — skipped`)
      results.skipped++
      return
    }
    seenCodes.add(code)

    if (existingByCode.has(code)) {
      results.errors.push(`Location code "${code}" already exists — skipped`)
      results.skipped++
      return
    }

    if (parentId && !(await canWriteToLocations(user, [parentId]))) {
      results.errors.push(`Location "${code}" parent "${parentName}" is outside your plant scope — skipped`)
      results.skipped++
      return
    }

    if (dryRun) {
      idByName.set(name, `dry:${code}`)
      pathByName.set(name, path)
      results.created++
      return
    }

    const loc = await prisma.location.create({ data: { name, code, parentId, path } })
    idByName.set(name, loc.id)
    pathByName.set(name, path)
    results.created++
  }

  let remaining = [...validRows]
  let madeProgress = true
  while (remaining.length > 0 && madeProgress) {
    madeProgress = false
    const next: typeof remaining = []
    for (const r of remaining) {
      const parentName = getField(r, 'Part of Facility')
      if (parentName && !idByName.has(parentName)) {
        next.push(r)
        continue
      }
      await createLocation(r)
      madeProgress = true
    }
    remaining = next
  }
  for (const r of remaining) {
    results.errors.push(`Location "${getField(r, 'Facility Code')}" parent "${getField(r, 'Part of Facility')}" not found — skipped`)
    results.skipped++
  }

  return NextResponse.json({
    success: true,
    dryRun,
    total: validRows.length,
    created: dryRun ? 0 : results.created,
    skipped: dryRun ? 0 : results.skipped,
    errors: results.errors,
    summary: {
      locations: validRows.length,
      newLocations: results.created,
      existingLocations: validRows.length - results.created,
    },
    preview: validRows.slice(0, 5).map(r => ({
      code: getField(r, 'Facility Code'),
      name: getField(r, 'Facility Name') || getField(r, 'Facility Code'),
      parent: getField(r, 'Part of Facility'),
    })),
  })
}

// ── MaintWiz Equipment ────────────────────────────────────────────────────────
interface MaintwizPlan {
  summary: Record<string, number | string[]>
  errors: string[]
  locationByCode: Map<string, string>
  domainByName: Map<string, string>
  categoryParentByName: Map<string, string>
  categorySubByKey: Map<string, string>
  groupIdByName: Map<string, string>
  ownerIdByName: Map<string, string>
  existingAssetCodes: Set<string>
  adminId: string | null
}

interface ImportUser {
  userId: string
  name?: string
  email?: string
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'REQUESTER' | 'VIEWER'
}

async function planMaintwizImport(rows: Record<string, string>[], user: ImportUser): Promise<MaintwizPlan> {
  const validRows = rows.filter(r => getField(r, 'Equipment Name') || getField(r, 'Equipment code'))
  const errors: string[] = []

  const codes = validRows.map(r => getField(r, 'Equipment code'))
  const codeSet = new Set(codes.filter(Boolean))
  const duplicateCodes = [...new Set(codes.filter((c, i) => c && codes.indexOf(c) !== i))]

  const facilityCodes = [...new Set(validRows.map(r => getField(r, 'Facility code')).filter(Boolean))]
  const groupNames = [...new Set(validRows.map(r => getField(r, 'Group')).filter(Boolean))]
  const subPairs = [...new Set(
    validRows
      .map(r => ({ group: getField(r, 'Group'), sub: getField(r, 'Sub Group') }))
      .filter(x => x.sub)
      .map(x => `${x.group}|||${x.sub}`),
  )]
  const domainNames = [...new Set(validRows.flatMap(r => engineeringDomains(getField(r, 'Engineering Group'))).filter(Boolean))]
  const ownerNames = [...new Set(validRows.map(r => getField(r, 'Owner')).filter(Boolean))]
  const ownerEmails = ownerNames.map(toOwnerEmail)

  // Unknown statuses
  const badStatuses = [...new Set(
    validRows.map(r => getField(r, 'Equipment Status')).filter(Boolean)
      .filter(s => !['PRODUCTION', 'NON PRODUCTION', 'DELETED'].includes(s.toUpperCase())),
  )]
  const badCriticality = [...new Set(
    validRows.map(r => getField(r, 'Criticality')).filter(Boolean)
      .filter(s => !VALID_CRITICALITY.includes(s.toUpperCase())),
  )]
  const missingCodes = validRows.filter(r => !getField(r, 'Equipment code'))

  const existingAssets = await prisma.asset.findMany({ where: { assetCode: { in: [...codeSet] } }, select: { assetCode: true } })
  const existingAssetCodes = new Set(existingAssets.map(a => a.assetCode).filter((c): c is string => !!c))

  const existingLocations = await prisma.location.findMany({ where: { code: { in: facilityCodes } }, select: { code: true, id: true } })
  const locationByCode = new Map(existingLocations.map(l => [l.code!, l.id]))

  const existingDomains = await prisma.maintenanceDomain.findMany({ where: { name: { in: domainNames } }, select: { name: true, id: true } })
  const domainByName = new Map(existingDomains.map(d => [d.name, d.id]))

  const allCategories = await prisma.assetCategory.findMany({ select: { id: true, name: true, parentId: true } })
  const categoryParentByName = new Map<string, string>()
  const categorySubByKey = new Map<string, string>()
  for (const c of allCategories) {
    const lower = c.name.toLowerCase()
    if (!c.parentId) {
      if (!categoryParentByName.has(lower)) categoryParentByName.set(lower, c.id)
    } else {
      categorySubByKey.set(`${lower}::${c.parentId}`, c.id)
    }
  }

  const existingUsers = await prisma.user.findMany({ where: { email: { in: ownerEmails } }, select: { email: true, id: true } })
  const userByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u.id]))

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true }, orderBy: { createdAt: 'asc' } })
  const adminId = adminUser?.id ?? null

  const ownerIdByName = new Map<string, string>()
  let newOwners = 0
  for (const name of ownerNames) {
    if (name.toLowerCase() === 'admin') {
      ownerIdByName.set(name, adminId ?? user.userId)
      continue
    }
    const existingId = userByEmail.get(toOwnerEmail(name).toLowerCase())
    if (existingId) {
      ownerIdByName.set(name, existingId)
    } else {
      newOwners++
    }
  }

  const newCategories = groupNames.filter(g => !categoryParentByName.has(g.toLowerCase())).length
  const newSubcategories = subPairs.filter(k => {
    const [g, s] = k.split('|||')
    const gLower = (g || '').toLowerCase()
    const parentId = categoryParentByName.get(gLower)
    if (!parentId) return true
    return !categorySubByKey.has(`${(s || '').toLowerCase()}::${parentId}`)
  }).length

  const summary: Record<string, number | string[]> = {
    assets: validRows.length,
    newAssets: validRows.filter(r => { const c = getField(r, 'Equipment code'); return !!c && !existingAssetCodes.has(c) }).length,
    locations: facilityCodes.length,
    missingLocations: facilityCodes.filter(c => !locationByCode.has(c)).length,
    categories: groupNames.length,
    newCategories,
    subcategories: subPairs.length,
    newSubcategories,
    domains: domainNames.length,
    newDomains: domainNames.filter(n => !domainByName.has(n)).length,
    owners: ownerNames.length,
    newOwners,
  }

  if (duplicateCodes.length > 0) {
    errors.push(`Duplicate equipment codes in file: ${duplicateCodes.slice(0, 5).join(', ')}${duplicateCodes.length > 5 ? '...' : ''}`)
  }
  if (missingCodes.length > 0) {
    errors.push(`Row(s) missing Equipment code: ${missingCodes.length}`)
  }
  if (badStatuses.length > 0) {
    errors.push(`Unknown Equipment Status values (will default to ACTIVE): ${badStatuses.slice(0, 5).join(', ')}${badStatuses.length > 5 ? '...' : ''}`)
  }
  if (badCriticality.length > 0) {
    errors.push(`Unknown Criticality values (will be left empty): ${badCriticality.slice(0, 5).join(', ')}${badCriticality.length > 5 ? '...' : ''}`)
  }

  return {
    summary, errors,
    locationByCode, domainByName, categoryParentByName, categorySubByKey,
    groupIdByName: new Map(), ownerIdByName, existingAssetCodes, adminId,
  }
}

async function handleMaintwizAssetsImport(text: string, user: ImportUser, dryRun: boolean) {
  const rows = parseCSVExact(text)
  const validRows = rows.filter(r => getField(r, 'Equipment Name') || getField(r, 'Equipment code'))
  const plan = await planMaintwizImport(validRows, user)

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      total: validRows.length,
      summary: plan.summary,
      errors: plan.errors,
      preview: validRows.slice(0, 5).map(r => ({
        code: getField(r, 'Equipment code'),
        name: getField(r, 'Equipment Name'),
        location: getField(r, 'Facility code'),
        category: getField(r, 'Group') + (getField(r, 'Sub Group') ? ` / ${getField(r, 'Sub Group')}` : ''),
        domain: engineeringDomains(getField(r, 'Engineering Group')).join(', '),
        owner: getField(r, 'Owner'),
        status: getField(r, 'Equipment Status'),
      })),
    })
  }

  const results = { created: 0, skipped: 0, errors: [...plan.errors] }
  const ownerPasswords: { email: string; password: string }[] = []

  // ── Reference data (idempotent) ─────────────────────────────────────────────
  const facilityCodes = [...new Set(validRows.map(r => getField(r, 'Facility code')).filter(Boolean))]
  for (const code of facilityCodes) {
    if (plan.locationByCode.has(code)) continue
    const loc = await prisma.location.create({ data: { name: code, code, path: code } })
    plan.locationByCode.set(code, loc.id)
  }

  const domainNames = [...new Set(validRows.flatMap(r => engineeringDomains(getField(r, 'Engineering Group'))).filter(Boolean))]
  for (const name of domainNames) {
    if (plan.domainByName.has(name)) continue
    const d = await prisma.maintenanceDomain.create({ data: { name } })
    plan.domainByName.set(name, d.id)
  }

  const groupNames = [...new Set(validRows.map(r => getField(r, 'Group')).filter(Boolean))]
  for (const g of groupNames) {
    const lower = g.toLowerCase()
    let id = plan.categoryParentByName.get(lower)
    if (!id) {
      const cat = await prisma.assetCategory.create({ data: { name: g } })
      plan.categoryParentByName.set(lower, cat.id)
      id = cat.id
    }
    plan.groupIdByName.set(g, id)
  }

  const subPairs = [...new Set(
    validRows
      .map(r => ({ group: getField(r, 'Group'), sub: getField(r, 'Sub Group') }))
      .filter(x => x.sub)
      .map(x => `${x.group}|||${x.sub}`),
  )]
  for (const k of subPairs) {
    const [g, s] = k.split('|||')
    const parentId = plan.groupIdByName.get(g || '')
    if (!parentId) continue
    const key = `${(s || '').toLowerCase()}::${parentId}`
    if (plan.categorySubByKey.has(key)) continue
    const cat = await prisma.assetCategory.create({ data: { name: s || '', parentId } })
    plan.categorySubByKey.set(key, cat.id)
  }

  const ownerNames = [...new Set(validRows.map(r => getField(r, 'Owner')).filter(Boolean))]
  for (const name of ownerNames) {
    if (plan.ownerIdByName.has(name)) continue
    if (name.toLowerCase() === 'admin') {
      plan.ownerIdByName.set(name, plan.adminId ?? user.userId)
      continue
    }
    const email = toOwnerEmail(name).toLowerCase()
    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username: slugify(name),
        passwordHash,
        role: 'TECHNICIAN',
        isActive: true,
        mustChangePassword: true,
      },
    })
    plan.ownerIdByName.set(name, newUser.id)
    ownerPasswords.push({ email, password: tempPassword })
  }

  // ── Assets ──────────────────────────────────────────────────────────────────
  for (const [i, r] of validRows.entries()) {
    const rowNum = i + 2
    const code = getField(r, 'Equipment code')
    if (!code) {
      results.errors.push(`Row ${rowNum}: missing Equipment code — skipped`)
      results.skipped++
      continue
    }
    if (plan.existingAssetCodes.has(code)) {
      results.errors.push(`Row ${rowNum}: asset_code "${code}" already exists — skipped`)
      results.skipped++
      continue
    }

    const locationCode = getField(r, 'Facility code')
    let locationId: string | null = null
    if (locationCode) {
      locationId = plan.locationByCode.get(locationCode) ?? null
      if (!locationId) {
        const loc = await prisma.location.create({ data: { name: locationCode, code: locationCode, path: locationCode } })
        plan.locationByCode.set(locationCode, loc.id)
        locationId = loc.id
      }
    }

    if (!(await canWriteToLocations(user, [locationId]))) {
      results.errors.push(`Row ${rowNum}: asset location is outside your plant scope — skipped`)
      results.skipped++
      continue
    }

    const group = getField(r, 'Group')
    const sub = getField(r, 'Sub Group')
    let categoryId: string | null = null
    if (group) {
      categoryId = sub
        ? (plan.categorySubByKey.get(`${sub.toLowerCase()}::${plan.groupIdByName.get(group) ?? ''}`) ?? null)
        : (plan.groupIdByName.get(group) ?? null)
    } else if (sub) {
      categoryId = plan.categoryParentByName.get(sub.toLowerCase()) ?? null
    }

    const domainIds = [...new Set(
      engineeringDomains(getField(r, 'Engineering Group'))
        .map(n => plan.domainByName.get(n))
        .filter((id): id is string => !!id),
    )]

    const owner = getField(r, 'Owner')
    const ownerId = owner ? (plan.ownerIdByName.get(owner) ?? null) : null

    const rawStatus = getField(r, 'Equipment Status').toUpperCase()
    const status = rawStatus === 'PRODUCTION' ? 'ACTIVE' : rawStatus === 'NON PRODUCTION' ? 'INACTIVE' : rawStatus === 'DELETED' ? 'DECOMMISSIONED' : 'ACTIVE'

    const rawCrit = getField(r, 'Criticality').toUpperCase()
    const criticality = VALID_CRITICALITY.includes(rawCrit) ? rawCrit : null

    const equipmentClass = getField(r, 'Equipment Class')
    const customFields: Record<string, unknown> = {}
    if (equipmentClass) customFields.equipmentClass = equipmentClass

    try {
      const asset = await prisma.asset.create({
        data: {
          name: getField(r, 'Equipment Name'),
          assetCode: code,
          description: getField(r, 'Description') || null,
          status: status as never,
          criticality: criticality as never,
          categoryId,
          locationId,
          domains: { create: domainIds.map(domainId => ({ domainId })) },
          ownerId,
          customFields: customFields as never,
          createdById: user.userId,
        },
      })
      await writeAudit({
        action: 'CREATE', entity: 'Asset', entityId: asset.id,
        entityName: asset.name, userId: user.userId,
        userName: user.name ?? '', userEmail: user.email ?? '',
      })
      results.created++
      plan.existingAssetCodes.add(code)
    } catch (e) {
      results.errors.push(`Row ${rowNum}: ${(e as Error).message}`)
      results.skipped++
    }
  }

  return NextResponse.json({
    success: true,
    dryRun: false,
    total: validRows.length,
    created: results.created,
    skipped: results.skipped,
    errors: results.errors,
    summary: plan.summary,
    ownerPasswords,
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'import:data'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await request.formData()
    const file     = formData.get('file') as File | null
    const type     = formData.get('type') as string | null
    const dryRun   = formData.get('dryRun') === 'true'

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!type) return NextResponse.json({ error: 'Import type required' }, { status: 400 })

    const text = await file.text()

    if (type === 'locations') {
      return handleLocationsImport(text, user, dryRun)
    }
    if (type === 'maintwiz_assets') {
      return handleMaintwizAssetsImport(text, user, dryRun)
    }

    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 })
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] }

    if (type === 'assets') {
      // Required: name, asset_code
      // Optional: description, status, manufacturer, model, serial_number,
      //           purchase_date, purchase_cost, category, location, parent_asset_code
      const assetMap = new Map<string, string>()

      for (const [i, row] of rows.entries()) {
        const rowNum = i + 2
        if (!row.name || !row.asset_code) {
          results.errors.push(`Row ${rowNum}: missing name or asset_code`)
          results.skipped++
          continue
        }

        // Check duplicate
        const existing = await prisma.asset.findUnique({ where: { assetCode: row.asset_code } })
        if (existing) {
          assetMap.set(row.asset_code, existing.id)
          results.errors.push(`Row ${rowNum}: asset_code "${row.asset_code}" already exists — skipped creation`)
          results.skipped++
          continue
        }

        // Resolve category
        let categoryId: string | null = null
        if (row.category) {
          let cat = await prisma.assetCategory.findFirst({ where: { name: { equals: row.category, mode: 'insensitive' } } })
          if (!cat) cat = await prisma.assetCategory.create({ data: { name: row.category } })
          categoryId = cat.id
        }

        // Resolve location
        let locationId: string | null = null
        if (row.location) {
          let loc = await prisma.location.findFirst({ where: { name: { equals: row.location, mode: 'insensitive' } } })
          if (!loc) loc = await prisma.location.create({ data: { name: row.location } })
          locationId = loc.id
        }

        // Plant scope enforcement: the asset's location must be within the user's scope
        if (!(await canWriteToLocations(user, [locationId]))) {
          results.errors.push(`Row ${rowNum}: asset location is outside your plant scope — skipped`)
          results.skipped++
          continue
        }

        const validStatuses = ['ACTIVE','INACTIVE','UNDER_MAINTENANCE','DECOMMISSIONED']
        const status = validStatuses.includes(row.status?.toUpperCase()) ? row.status.toUpperCase() : 'ACTIVE'

        try {
          const asset = await prisma.asset.create({
            data: {
              name:              row.name,
              assetCode:         row.asset_code,
              description:       row.description  || null,
              status:            status as never,
              manufacturer:      row.manufacturer || null,
              model:             row.model        || null,
              serialNumber:      row.serial_number || null,
              purchaseDate:      row.purchase_date ? new Date(row.purchase_date) : null,
              purchaseCost:      row.purchase_cost ? parseFloat(row.purchase_cost) : null,
              criticality:       (row.criticality as any) || null,
              warrantyExpiry:    row.warranty_expiry ? new Date(row.warranty_expiry) : null,
              warrantyNotes:     row.warranty_notes || null,
              meterUnit:         row.meter_unit || null,
              currentMeterValue: row.current_meter_value ? parseFloat(row.current_meter_value) : null,
              categoryId,
              locationId,
              createdById:       user.userId,
            },
          })
          assetMap.set(row.asset_code, asset.id)
          await writeAudit({
            action: 'CREATE', entity: 'Asset', entityId: asset.id,
            entityName: asset.name, userId: user.userId,
            userName: user.name, userEmail: user.email,
          })
          results.created++
        } catch (e) {
          results.errors.push(`Row ${rowNum}: ${(e as Error).message}`)
          results.skipped++
        }
      }

      // Pass 2: Establish parent-child hierarchy links using parent_asset_code
      for (const [i, row] of rows.entries()) {
        const rowNum = i + 2
        if (row.asset_code && row.parent_asset_code) {
          const childId = assetMap.get(row.asset_code)
          if (!childId) continue // skipped due to error in Pass 1

          let parentId = assetMap.get(row.parent_asset_code)
          if (!parentId) {
            const parentAsset = await prisma.asset.findUnique({ where: { assetCode: row.parent_asset_code } })
            if (parentAsset) {
              parentId = parentAsset.id
              assetMap.set(row.parent_asset_code, parentId)
            }
          }

          if (parentId) {
            if (!(await canWriteToAssets(user, [parentId]))) {
              results.errors.push(`Row ${rowNum} Hierarchy Link Error: parent asset is outside your plant scope`)
              continue
            }
            try {
              await prisma.asset.update({
                where: { id: childId },
                data: { parentId },
              })
            } catch (e) {
              results.errors.push(`Row ${rowNum} Hierarchy Link Error: ${(e as Error).message}`)
            }
          } else {
            results.errors.push(`Row ${rowNum}: Parent asset code "${row.parent_asset_code}" not found — hierarchy skipped`)
          }
        }
      }

    } else if (type === 'work_orders') {
      // Required: title
      // Optional: description, type, priority, status, due_date, assigned_to, asset_code, category
      for (const [i, row] of rows.entries()) {
        const rowNum = i + 2
        if (!row.title) {
          results.errors.push(`Row ${rowNum}: missing title`)
          results.skipped++
          continue
        }

        // Resolve assigned user by email
        let assignedToId: string | null = null
        if (row.assigned_to) {
          const assignee = await prisma.user.findFirst({
            where: { email: { equals: row.assigned_to, mode: 'insensitive' }, isActive: true },
          })
          if (!assignee) {
            results.errors.push(`Row ${rowNum}: user "${row.assigned_to}" not found — assigned_to skipped`)
          } else {
            assignedToId = assignee.id
          }
        }

        // Resolve asset by asset_code
        let assetId: string | null = null
        if (row.asset_code) {
          const asset = await prisma.asset.findUnique({ where: { assetCode: row.asset_code } })
          if (!asset) {
            results.errors.push(`Row ${rowNum}: asset_code "${row.asset_code}" not found — asset skipped`)
          } else {
            assetId = asset.id
          }
        }

        // Resolve category by name
        let categoryId: string | null = null
        if (row.category) {
          let cat = await prisma.assetCategory.findFirst({ where: { name: { equals: row.category, mode: 'insensitive' } } })
          if (!cat) cat = await prisma.assetCategory.create({ data: { name: row.category } })
          categoryId = cat.id
        }

        // Validate type
        const validTypes = ['BREAKDOWN', 'PREVENTIVE', 'PREDICTIVE']
        const woType = validTypes.includes(row.type?.toUpperCase()) ? row.type.toUpperCase() : 'BREAKDOWN'

        // Plant scope enforcement: assigned user and asset must be within the user's scope
        if (assignedToId && !(await canAssignUsers(user, [assignedToId]))) {
          results.errors.push(`Row ${rowNum}: assigned user is outside your plant scope — skipped`)
          results.skipped++
          continue
        }
        if (assetId && !(await canWriteToAssets(user, [assetId]))) {
          results.errors.push(`Row ${rowNum}: asset is outside your plant scope — skipped`)
          results.skipped++
          continue
        }

        // Validate priority
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        const priority = validPriorities.includes(row.priority?.toUpperCase()) ? row.priority.toUpperCase() : 'MEDIUM'

        // Validate status
        const validStatuses = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']
        const status = validStatuses.includes(row.status?.toUpperCase()) ? row.status.toUpperCase() : 'OPEN'

        // Generate WO number
        const woNumber = await generateWONumber()

        try {
          const wo = await prisma.workOrder.create({
            data: {
              woNumber,
              title: row.title,
              description: row.description || null,
              type: woType as never,
              priority: priority as never,
              status: status as never,
              dueDate: row.due_date ? new Date(row.due_date) : null,
              assignedToId,
              assetId,
              categoryId,
              createdById: user.userId,
            },
          })
          await writeAudit({
            action: 'CREATE', entity: 'WorkOrder', entityId: wo.id,
            entityName: wo.title, userId: user.userId,
            userName: user.name, userEmail: user.email,
          })
          results.created++
        } catch (e) {
          results.errors.push(`Row ${rowNum}: ${(e as Error).message}`)
          results.skipped++
        }
      }

    } else if (type === 'parts') {
      // Required: name, part_number
      // Optional: description, unit_cost, unit
      for (const [i, row] of rows.entries()) {
        const rowNum = i + 2
        if (!row.name || !row.part_number) {
          results.errors.push(`Row ${rowNum}: missing name or part_number`)
          results.skipped++
          continue
        }

        const existing = await prisma.part.findUnique({ where: { partNumber: row.part_number } })
        if (existing) {
          results.errors.push(`Row ${rowNum}: part_number "${row.part_number}" already exists — skipped`)
          results.skipped++
          continue
        }

        try {
          const part = await prisma.part.create({
            data: {
              name:        row.name,
              partNumber:  row.part_number,
              description: row.description  || null,
              unitCost:    row.unit_cost    ? parseFloat(row.unit_cost)  : null,
              unit:        row.unit         || 'pcs',
              createdById: user.userId,
            },
          })
          await writeAudit({
            action: 'CREATE', entity: 'Part', entityId: part.id,
            entityName: part.name, userId: user.userId,
            userName: user.name, userEmail: user.email,
          })
          results.created++
        } catch (e) {
          results.errors.push(`Row ${rowNum}: ${(e as Error).message}`)
          results.skipped++
        }
      }

    } else {
      return NextResponse.json({ error: 'Invalid import type. Use "assets", "parts", "work_orders", "locations", or "maintwiz_assets"' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      created: results.created,
      skipped: results.skipped,
      errors:  results.errors,
      total:   rows.length,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
