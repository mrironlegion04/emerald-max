import nodemailer from 'nodemailer'
import { fmt } from '@/lib/utils'

// ── Transporter ──────────────────────────────────────────────────────────────
// Uses env vars. For local dev, set EMAIL_HOST=smtp.gmail.com or use Mailtrap.
// See .env.local.example for all required vars.
function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   ?? 'smtp.mailtrap.io',
    port:   parseInt(process.env.EMAIL_PORT ?? '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER ?? '',
      pass: process.env.EMAIL_PASS ?? '',
    },
  })
}

const FROM = process.env.EMAIL_FROM ?? 'CMMS <noreply@cmms.local>'
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

// ── Template helper ───────────────────────────────────────────────────────────
function html(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f9fafb; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
  .header { background: #2563eb; padding: 24px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 18px; font-weight: 600; }
  .body { padding: 28px 32px; }
  .body p { margin: 0 0 16px; line-height: 1.6; font-size: 14px; color: #374151; }
  .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-top: 8px; }
  .meta { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px; font-size: 12px; color: #9ca3af; }
  .chip { display:inline-block; background:#eff6ff; color:#1d4ed8; padding:3px 10px; border-radius:99px; font-size:12px; font-weight:500; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>CMMS</h1></div>
  <div class="body">
    <p style="font-size:16px;font-weight:600;margin-bottom:20px">${title}</p>
    ${body}
  </div>
  <div class="meta">This is an automated message from your CMMS. Do not reply.</div>
</div>
</body></html>`
}

// ── Notification functions ────────────────────────────────────────────────────

export async function sendWOAssigned(opts: {
  toEmail: string; toName: string
  woNumber: string; woTitle: string; woId: string
  priority: string; dueDate: string | null
  assetName: string | null
}) {
  if (!process.env.EMAIL_USER) return // silently skip if email not configured

  const priorityColor: Record<string, string> = {
    CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#3b82f6', LOW: '#9ca3af',
  }

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>A work order has been assigned to you:</p>
    <p style="margin:16px 0;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid ${priorityColor[opts.priority] ?? '#3b82f6'}">
      <strong>${opts.woTitle}</strong><br>
      <span style="font-size:12px;color:#6b7280">
        ${opts.woNumber}
        ${opts.assetName ? ` · ${opts.assetName}` : ''}
        ${opts.dueDate ? ` · Due ${fmt(opts.dueDate)}` : ''}
      </span><br>
      <span class="chip">${opts.priority}</span>
    </p>
    <a href="${BASE}/work-orders/${opts.woId}" class="btn">View work order</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] Work order assigned: ${opts.woNumber}`,
    html:    html(`Work order assigned to you`, body),
  })
}

export async function sendWOOverdue(opts: {
  toEmail: string; toName: string
  woNumber: string; woTitle: string; woId: string
  daysOverdue: number; assetName: string | null
}) {
  if (!process.env.EMAIL_USER) return

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>A work order assigned to you is <strong style="color:#ef4444">${opts.daysOverdue} day${opts.daysOverdue !== 1 ? 's' : ''} overdue</strong>:</p>
    <p style="margin:16px 0;padding:16px;background:#fef2f2;border-radius:8px;border-left:4px solid #ef4444">
      <strong>${opts.woTitle}</strong><br>
      <span style="font-size:12px;color:#6b7280">${opts.woNumber}${opts.assetName ? ` · ${opts.assetName}` : ''}</span>
    </p>
    <p>Please update the status or contact your manager if you need assistance.</p>
    <a href="${BASE}/work-orders/${opts.woId}" class="btn">View work order</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] Overdue: ${opts.woNumber} — ${opts.daysOverdue}d past due`,
    html:    html(`Work order overdue`, body),
  })
}

export async function sendWOCompleted(opts: {
  toEmail: string; toName: string
  woNumber: string; woTitle: string; woId: string
  completedBy: string; laborHours: number | null; totalCost: number
}) {
  if (!process.env.EMAIL_USER) return

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>A work order has been completed:</p>
    <p style="margin:16px 0;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e">
      <strong>${opts.woTitle}</strong><br>
      <span style="font-size:12px;color:#6b7280">${opts.woNumber}</span>
    </p>
    <p><strong>Completed by:</strong> ${opts.completedBy}</p>
    ${opts.laborHours ? `<p><strong>Labor hours:</strong> ${opts.laborHours}h</p>` : ''}
    ${opts.totalCost ? `<p><strong>Total cost:</strong> $${opts.totalCost.toFixed(2)}</p>` : ''}
    <a href="${BASE}/work-orders/${opts.woId}" class="btn">View work order</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] Completed: ${opts.woNumber}`,
    html:    html(`Work order completed`, body),
  })
}

export async function sendOverdueDigest(opts: {
  toEmail: string; toName: string
  overdueItems: { woNumber: string; title: string; daysOverdue: number; assignedTo: string | null }[]
}) {
  if (!process.env.EMAIL_USER) return

  const rows = opts.overdueItems.map(w => `
    <tr>
      <td style="padding:8px;font-size:13px;border-bottom:1px solid #f3f4f6">${w.woNumber}</td>
      <td style="padding:8px;font-size:13px;border-bottom:1px solid #f3f4f6">${w.title}</td>
      <td style="padding:8px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#ef4444;font-weight:600">${w.daysOverdue}d</td>
      <td style="padding:8px;font-size:13px;border-bottom:1px solid #f3f4f6">${w.assignedTo ?? 'Unassigned'}</td>
    </tr>
  `).join('')

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>Here is a summary of <strong>${opts.overdueItems.length} overdue work order${opts.overdueItems.length !== 1 ? 's' : ''}</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">WO #</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Title</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Overdue</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Assigned</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <a href="${BASE}/work-orders?status=OPEN" class="btn">View all open WOs</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] ${opts.overdueItems.length} overdue work order${opts.overdueItems.length !== 1 ? 's' : ''} — daily digest`,
    html:    html('Overdue work orders digest', body),
  })
}

// Maintenance Request notifications
export async function sendRequestApproved(opts: {
  toEmail: string; toName: string
  requestId: string; requestTitle: string
  approvedBy: string
}) {
  if (!process.env.EMAIL_USER) return

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>Your maintenance request has been approved:</p>
    <p style="margin:16px 0;padding:16px;background:#dbeafe;border-radius:8px;border-left:4px solid #3b82f6">
      <strong>${opts.requestTitle}</strong>
    </p>
    <p><strong>Approved by:</strong> ${opts.approvedBy}</p>
    <p>A work order will be generated to address your request.</p>
    <a href="${BASE}/maintenance-requests/${opts.requestId}" class="btn">View request</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] Approved: ${opts.requestTitle}`,
    html:    html('Maintenance request approved', body),
  })
}

export async function sendRequestRejected(opts: {
  toEmail: string; toName: string
  requestId: string; requestTitle: string
  rejectionReason?: string
  rejectedBy: string
}) {
  if (!process.env.EMAIL_USER) return

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>Your maintenance request has been rejected:</p>
    <p style="margin:16px 0;padding:16px;background:#fee2e2;border-radius:8px;border-left:4px solid #ef4444">
      <strong>${opts.requestTitle}</strong>
    </p>
    ${opts.rejectionReason ? `<p><strong>Reason:</strong> ${opts.rejectionReason}</p>` : ''}
    <p><strong>Rejected by:</strong> ${opts.rejectedBy}</p>
    <a href="${BASE}/maintenance-requests/${opts.requestId}" class="btn">View request</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] Rejected: ${opts.requestTitle}`,
    html:    html('Maintenance request rejected', body),
  })
}

export async function sendRequestConverted(opts: {
  toEmail: string; toName: string
  requestId: string; requestTitle: string
  woNumber: string; woId: string
  convertedBy: string
}) {
  if (!process.env.EMAIL_USER) return

  const body = `
    <p>Hi ${opts.toName},</p>
    <p>Your maintenance request has been converted to a work order:</p>
    <p style="margin:16px 0;padding:16px;background:#d1fae5;border-radius:8px;border-left:4px solid #10b981">
      <strong>${opts.requestTitle}</strong><br>
      <span style="font-size:12px;color:#6b7280">Work Order: ${opts.woNumber}</span>
    </p>
    <p><strong>Converted by:</strong> ${opts.convertedBy}</p>
    <a href="${BASE}/work-orders/${opts.woId}" class="btn">View work order</a>
  `

  await getTransporter().sendMail({
    from:    FROM,
    to:      opts.toEmail,
    subject: `[CMMS] Converted: ${opts.requestTitle} — ${opts.woNumber}`,
    html:    html('Maintenance request converted', body),
  })
}

/**
 * Generic email sender for any message
 */
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}) {
  if (!process.env.EMAIL_USER) return

  await getTransporter().sendMail({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}