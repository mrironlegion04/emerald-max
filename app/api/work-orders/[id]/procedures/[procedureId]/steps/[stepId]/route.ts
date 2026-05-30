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

function validateValue(type: string, value: string | null, options: string[]): string | null {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'NUMBER_INPUT':
    case 'METER':
      if (value === '') return null
      if (isNaN(Number(value))) return 'Value must be a valid number'
      break
    case 'SINGLE_SELECT':
    case 'DROPDOWN':
      if (value === '') return null
      if (!options.includes(value)) return `Value must be one of: ${options.join(', ')}`
      break
    case 'INSPECTION':
      if (value !== 'PASS' && value !== 'FLAG' && value !== 'FAIL') return 'Value must be PASS, FLAG, or FAIL'
      break
    case 'SIGNATURE':
      if (!value) return 'Signature is required'
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
    include: { procedure: { include: { workOrder: true } } },
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
    updateData.isChecked = stringValue !== null && stringValue !== ''
    updateData.checkedAt = stringValue !== null && stringValue !== '' ? new Date() : null
    updateData.checkedBy = stringValue !== null && stringValue !== '' ? user.name : null
  }
  
  const step = await prisma.wOProcedureStep.update({
    where: { id: stepId },
    data: updateData,
  })

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
