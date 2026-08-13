import { prisma } from '@/lib/db'
import { isOverdueByDate, todayUTC } from '@/lib/date-format'

interface Condition {
  field: string
  operator: string
  value: string | number | boolean
}

interface Action {
  type: string
  params: Record<string, any>
}

interface TriggerContext {
  triggerType: string
  workOrder?: any
  asset?: any
  schedule?: any
  user?: any
  [key: string]: any
}

export async function evaluateRules(triggerType: string, context: TriggerContext) {
  const rules = await prisma.automationRule.findMany({
    where: { isActive: true, triggerType },
    orderBy: { priority: 'desc' },
  })

  for (const rule of rules) {
    const conditions = (rule.conditions as unknown as Condition[])
    const actions = (rule.actions as unknown as Action[])

    // Check if all conditions pass
    const allConditionsMet = conditions.length === 0 || conditions.every(c =>
      evaluateCondition(c, context)
    )

    if (!allConditionsMet) continue

    // Execute actions
    for (const action of actions) {
      try {
        await executeAction(action, context)
      } catch (err) {
        console.error(`Automation rule "${rule.name}" action "${action.type}" failed:`, err)
      }
    }
  }
}

function evaluateCondition(condition: Condition, context: TriggerContext): boolean {
  const fieldValue = getFieldValue(condition.field, context)
  const conditionValue = condition.value

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue).toLowerCase() === String(conditionValue).toLowerCase()
    case 'not_equals':
      return String(fieldValue).toLowerCase() !== String(conditionValue).toLowerCase()
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase())
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue)
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue)
    case 'in':
      const values = String(conditionValue).split(',').map(v => v.trim().toLowerCase())
      return values.includes(String(fieldValue).toLowerCase())
    default:
      return true
  }
}

function getFieldValue(field: string, context: TriggerContext): any {
  const wo = context.workOrder
  if (!wo) return undefined

  switch (field) {
    case 'priority': return wo.priority
    case 'type': return wo.type
    case 'status': return wo.status
    case 'assignedToId': return wo.assignedToId
    case 'domainId': return wo.domainId
    case 'categoryId': return wo.categoryId
    case 'title': return wo.title
    case 'description': return wo.description
    case 'hasAsset': return !!wo.assetId
    case 'hasDescription': return !!wo.description
    case 'assetStatus': return wo.asset?.status
    case 'assetCategory': return wo.asset?.category?.name
    case 'assetLocation': return wo.asset?.location?.name
    case 'isOverdue': return wo.dueDate && isOverdueByDate(wo.dueDate, todayUTC()) && !['COMPLETED', 'CANCELLED'].includes(wo.status)
    case 'isPmGenerated': return !!wo.maintenanceScheduleId
    default: return undefined
  }
}

async function executeAction(action: Action, context: TriggerContext) {
  const wo = context.workOrder
  if (!wo) return

  switch (action.type) {
    case 'assign_user':
      if (action.params.userId) {
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: { assignedToId: action.params.userId },
        })
      }
      break

    case 'set_priority':
      if (action.params.priority) {
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: { priority: action.params.priority as any },
        })
      }
      break

    case 'send_notification':
      if (action.params.userId && action.params.title) {
        const { createNotification } = await import('@/lib/notifications')
        await createNotification({
          userId: action.params.userId,
          title: action.params.title,
          message: action.params.message || `Automation: ${action.params.title}`,
          type: 'WORK_ORDER_COMPLETED',
          entityId: wo.id,
          href: `/work-orders/${wo.id}`,
        })
      }
      break

    case 'update_field':
      if (action.params.field && action.params.value !== undefined) {
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: { [action.params.field]: action.params.value },
        })
      }
      break
  }
}
