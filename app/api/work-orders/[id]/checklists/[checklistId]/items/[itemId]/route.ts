import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const stepTypeEnum = z.enum(['CHECKBOX','TEXT_INPUT','NUMBER_INPUT','SINGLE_SELECT','INSPECTION','SIGNATURE'])

const updateSchema = z.object({
  isChecked: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  stringValue: z.string().nullable().optional(),
})

function validateValue(type: string, value: string | null, options: string[]): string | null {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'NUMBER_INPUT':
      if (value === '') return null
      if (isNaN(Number(value))) return 'Value must be a valid number'
      break
    case 'SINGLE_SELECT':
      if (value === '') return null
      if (!options.includes(value)) return `Value must be one of: ${options.join(', ')}`
      break
    case 'INSPECTION':
      if (value !== 'PASS' && value !== 'FAIL') return 'Value must be PASS or FAIL'
      break
    case 'SIGNATURE':
      if (!value) return 'Signature is required'
      break
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params
  const { isChecked, isMandatory, stringValue } = updateSchema.parse(await req.json())
  
  const existingItem = await prisma.wOChecklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: { include: { workOrder: true } } },
  })
  if (!existingItem) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })

  const validationError = validateValue(existingItem.type, stringValue ?? null, existingItem.options)
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
  
  const item = await prisma.wOChecklistItem.update({
    where: { id: itemId },
    data: updateData,
  })

  if (isChecked !== undefined && existingItem.isChecked !== isChecked) {
    await writeAudit({
      action: 'UPDATE',
      entity: 'Work Order',
      entityId: existingItem.checklist.workOrder.id,
      entityName: existingItem.checklist.workOrder.title,
      changes: {
        [`Checklist Item: ${existingItem.label}`]: {
          before: existingItem.isChecked ? 'Checked' : 'Unchecked',
          after: isChecked ? 'Checked' : 'Unchecked',
        }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })
  }

  return NextResponse.json(item)
}