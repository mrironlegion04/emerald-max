import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  isChecked: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  stringValue: z.string().nullable().optional(),
})

// Support parsing MaintainX-style JSON string values to obtain the pure raw input
function parseStepValue(raw: string | null): string | null {
  if (!raw) return null
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return parsed.value !== undefined && parsed.value !== null ? String(parsed.value) : null
    } catch {
      // fallback
    }
  }
  return raw
}

function validateValue(type: string, value: string | null, options: string[]): string | null {
  if (value === null || value === undefined) return null
  const parsedValue = parseStepValue(value)
  if (parsedValue === null || parsedValue === '') return null

  switch (type) {
    case 'NUMBER_INPUT':
    case 'METER':
      if (isNaN(Number(parsedValue))) return 'Value must be a valid number'
      break
    case 'SINGLE_SELECT':
    case 'DROPDOWN':
      if (!options.includes(parsedValue)) return `Value must be one of: ${options.join(', ')}`
      break
    case 'INSPECTION':
      if (parsedValue !== 'PASS' && parsedValue !== 'FLAG' && parsedValue !== 'FAIL') return 'Value must be PASS, FLAG, or FAIL'
      break
    case 'SIGNATURE':
      if (!parsedValue) return 'Signature is required'
      break
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; procedureId: string; stepId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { stepId } = await params
  const { isChecked, isMandatory, stringValue } = updateSchema.parse(await req.json())
  
  const existingStep = await prisma.wOProcedureStep.findUnique({
    where: { id: stepId },
    include: { 
      procedure: { 
        include: { 
          workOrder: true 
        } 
      } 
    },
  })
  if (!existingStep) return NextResponse.json({ error: 'Procedure step not found' }, { status: 404 })

  const validationError = validateValue(existingStep.type, stringValue ?? null, existingStep.options)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 })
  }

  const updateData: Record<string, unknown> = {}
  if (isChecked !== undefined) {
    updateData.isChecked = isChecked
    updateData.checkedAt = isChecked ? new Date() : null
    updateData.checkedBy = isChecked ? user.name : null
  }
  if (isMandatory !== undefined) {
    updateData.isMandatory = isMandatory
  }
  if (stringValue !== undefined) {
    updateData.stringValue = stringValue
    const hasVal = stringValue !== null && stringValue !== ''
    updateData.isChecked = hasVal
    updateData.checkedAt = hasVal ? new Date() : null
    updateData.checkedBy = hasVal ? user.name : null
  }
  
  const step = await prisma.wOProcedureStep.update({
    where: { id: stepId },
    data: updateData,
  })

  // Magic Feature: If METER step, automatically log physical telemetry readings in Asset History!
  if (existingStep.type === 'METER' && stringValue) {
    const rawNumStr = parseStepValue(stringValue)
    if (rawNumStr !== null && rawNumStr !== '' && !isNaN(Number(rawNumStr))) {
      const targetAssetId = existingStep.assetId ?? existingStep.procedure.workOrder.assetId
      if (targetAssetId) {
        try {
          const settings = (existingStep.settings as Record<string, any>) || {}
          const unit = settings.unit || 'Reading'

          // Find appropriate active meter on this asset
          let meter = await prisma.meter.findFirst({
            where: {
              assetId: targetAssetId,
              deletedAt: null,
              unit: { equals: unit, mode: 'insensitive' }
            }
          })

          if (!meter) {
            meter = await prisma.meter.findFirst({
              where: {
                assetId: targetAssetId,
                deletedAt: null,
                isPrimary: true
              }
            })
          }

          if (!meter) {
            meter = await prisma.meter.findFirst({
              where: {
                assetId: targetAssetId,
                deletedAt: null
              }
            })
          }

          // Automatically create a new meter if asset doesn't have one
          if (!meter) {
            meter = await prisma.meter.create({
              data: {
                name: `${existingStep.label} Meter`,
                unit: unit,
                assetId: targetAssetId,
                isPrimary: false
              }
            })
          }

          // Create reading entry in the history
          await prisma.meterReading.create({
            data: {
              value: Number(rawNumStr),
              readingDate: new Date(),
              notes: `Logged via SOP step: "${existingStep.label}"`,
              source: 'MANUAL',
              status: 'VALID',
              meterId: meter.id,
              assetId: targetAssetId,
              recordedBy: user.name,
              recordedById: user.userId
            }
          })

          // Update meter log
          await prisma.meter.update({
            where: { id: meter.id },
            data: {
              lastValue: Number(rawNumStr),
              lastReadingAt: new Date()
            }
          })

        } catch (meterErr) {
          console.error('Failed to log SOP physical telemetry:', meterErr)
        }
      }
    }
  }

  if (isChecked !== undefined && existingStep.isChecked !== isChecked) {
    await writeAudit({
      action: 'UPDATE',
      entity: 'Work Order',
      entityId: existingStep.procedure.workOrder.id,
      entityName: existingStep.procedure.workOrder.title,
      changes: {
        [`Procedure Step: ${existingStep.label}`]: {
          before: existingStep.isChecked ? 'Checked' : 'Unchecked',
          after: isChecked ? 'Checked' : 'Unchecked',
        }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })
  }

  return NextResponse.json(step)
}
