import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canViewWorkOrder } from '@/lib/access-control'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 12, textAlign: 'center', color: '#666', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  headerItem: { width: '30%' },
  label: { fontSize: 8, fontWeight: 'bold', color: '#888', textTransform: 'uppercase' as const, marginBottom: 4 },
  value: { fontSize: 11, fontWeight: 'bold' },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  text: { fontSize: 9, marginBottom: 4, lineHeight: 1.4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  col2: { width: '50%' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  table: { marginBottom: 8 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontSize: 8, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingBottom: 4 },
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // PDF rendering exposes the full WO — enforce the same visibility rules as the JSON endpoint
    const viewAccess = await canViewWorkOrder(user, id)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: viewAccess.reason }, { status: 403 })
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        asset: { select: { name: true, assetCode: true, serialNumber: true, location: { select: { name: true } } } },
        assignedTo: { select: { name: true } },
        domain: { select: { name: true } },
        createdBy: { select: { name: true } },
        partsUsed: { include: { part: { select: { name: true, partNumber: true, unitCost: true } } } },
      },
    })

    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const statusLabels: Record<string, string> = {
      OPEN: 'Open', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold',
      PENDING_APPROVAL: 'Pending Approval', COMPLETED: 'Completed',
      CLOSED: 'Closed', CANCELLED: 'Cancelled',
    }
    const typeLabels: Record<string, string> = {
      BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
    }
    const priorityLabels: Record<string, string> = {
      LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
    }

    const fmtCurrency = (v: number | null) => v != null ? `$${v.toFixed(2)}` : '$0.00'
    const fmtDate = (d: Date | string | null) => {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    const fmtDateTime = (d: Date | string | null) => {
      if (!d) return '—'
      return new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    }

    const totalCost = Number(wo.laborCost ?? 0) + Number(wo.partsCost ?? 0)

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Work Order</Text>
          <Text style={styles.subtitle}>{wo.woNumber}</Text>

          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.headerItem}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{statusLabels[wo.status]}</Text>
            </View>
            <View style={styles.headerItem}>
              <Text style={styles.label}>Priority</Text>
              <Text style={styles.value}>{priorityLabels[wo.priority]}</Text>
            </View>
            <View style={styles.headerItem}>
              <Text style={styles.label}>Type</Text>
              <Text style={styles.value}>{typeLabels[wo.type]}</Text>
            </View>
          </View>

          {/* Title & description */}
          <Text style={[styles.sectionTitle, { borderBottomWidth: 0, marginTop: 0 }]}>{wo.title}</Text>
          {wo.description && <Text style={styles.text}>{wo.description}</Text>}

          {/* Asset & Assignment */}
          <View style={styles.sectionTitle}><Text style={styles.label}>Details</Text></View>
          <View style={styles.row}>
            <View style={styles.col2}>
              {wo.asset && (
                <>
                  <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Asset:</Text> {wo.assetNameSnapshot ?? wo.asset.name} ({wo.asset.assetCode})</Text>
                  {wo.asset.serialNumber && <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Serial:</Text> {wo.asset.serialNumber}</Text>}
                  {(wo.locationNameSnapshot ?? wo.asset.location) && <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Location:</Text> {wo.locationNameSnapshot ?? wo.asset.location?.name}</Text>}
                </>
              )}
              {!wo.asset && <Text style={styles.text}>No asset assigned</Text>}
            </View>
            <View style={styles.col2}>
              {(wo.domainNameSnapshot ?? wo.domain) && <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Domain:</Text> {wo.domainNameSnapshot ?? wo.domain?.name}</Text>}
              {wo.assignedTo && <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Assigned to:</Text> {wo.assignedTo.name}</Text>}
              <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Created:</Text> {fmtDateTime(wo.createdAt)}</Text>
              {wo.dueDate && <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Due:</Text> {fmtDate(wo.dueDate)}</Text>}
              {wo.completedAt && <Text style={styles.text}><Text style={{ fontWeight: 'bold' }}>Completed:</Text> {fmtDateTime(wo.completedAt)}</Text>}
            </View>
          </View>

          {/* Labor & Cost */}
          <View style={styles.sectionTitle}><Text style={styles.label}>Labor & Cost</Text></View>
          {wo.laborHours && <Text style={styles.text}>Labor hours: {wo.laborHours} hrs</Text>}
          <Text style={styles.text}>Labor cost: {fmtCurrency(wo.laborCost != null ? Number(wo.laborCost) : null)}</Text>
          <Text style={styles.text}>Parts cost: {fmtCurrency(wo.partsCost != null ? Number(wo.partsCost) : null)}</Text>
          <Text style={[styles.text, { fontWeight: 'bold' }]}>Total: {fmtCurrency(totalCost)}</Text>

          {/* Parts used */}
          {wo.partsUsed.length > 0 && (
            <>
              <View style={styles.sectionTitle}><Text style={styles.label}>Parts Used</Text></View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { width: '40%' }]}>Part</Text>
                <Text style={[styles.tableHeaderText, { width: '15%', textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.tableHeaderText, { width: '22%', textAlign: 'right' }]}>Unit Cost</Text>
                <Text style={[styles.tableHeaderText, { width: '23%', textAlign: 'right' }]}>Total</Text>
              </View>
              {wo.partsUsed.map((p: any) => {
                const unitCost = Number(p.unitCost ?? p.part.unitCost ?? 0)
                const total = unitCost * p.quantity
                return (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={{ width: '40%', fontSize: 9 }}>{p.part.name}</Text>
                    <Text style={{ width: '15%', textAlign: 'center', fontSize: 9 }}>{p.quantity}</Text>
                    <Text style={{ width: '22%', textAlign: 'right', fontSize: 9 }}>{fmtCurrency(unitCost)}</Text>
                    <Text style={{ width: '23%', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>{fmtCurrency(total)}</Text>
                  </View>
                )
              })}
            </>
          )}

          {/* Notes */}
          {wo.notes && (
            <>
              <View style={styles.sectionTitle}><Text style={styles.label}>Notes</Text></View>
              <Text style={styles.text}>{wo.notes}</Text>
            </>
          )}

          <Text style={styles.footer}>
            Generated {fmtDateTime(new Date())} by {user.name}
          </Text>
        </Page>
      </Document>
    )

    const buffer = await renderToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${wo.woNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
