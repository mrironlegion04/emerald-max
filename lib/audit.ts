import { prisma } from './db'

interface AuditOptions {
  action:     'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'LOGIN'
  entity:     string
  entityId:   string
  entityName: string
  changes?:   Record<string, { before: unknown; after: unknown }>
  userId?:    string
  userName?:  string
  userEmail?: string
}

export async function writeAudit(opts: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        action:     opts.action,
        entity:     opts.entity,
        entityId:   opts.entityId,
        entityName: opts.entityName,
        changes:    opts.changes ? JSON.stringify(opts.changes) : null,
        userId:     opts.userId    ?? null,
        userName:   opts.userName  ?? null,
        userEmail:  opts.userEmail ?? null,
      },
    })
  } catch (err) {
    // Audit logging should never break the main operation
    console.error('Audit log write failed:', err)
  }
}