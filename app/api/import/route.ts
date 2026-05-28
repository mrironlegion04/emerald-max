import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').map(l => l.replace(/\r/g, ''))
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const fields: string[] = []
    let inQuote = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { fields.push(current.trim()); current = ''; continue }
      current += ch
    }
    fields.push(current.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = fields[i] ?? '' })
    return obj
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await request.formData()
    const file     = formData.get('file') as File | null
    const type     = formData.get('type') as string | null

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!type) return NextResponse.json({ error: 'Import type required' }, { status: 400 })

    const text = await file.text()
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
              criticality:       row.criticality || null,
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
      return NextResponse.json({ error: 'Invalid import type. Use "assets" or "parts"' }, { status: 400 })
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