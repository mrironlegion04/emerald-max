import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Fetch the maintenance procedure with its steps ordered by sortOrder, and includes step attachments
    let procedure = await prisma.maintenanceProcedure.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { sortOrder: 'asc' },
          include: {
            attachments: true,
          },
        },
      },
    })

    // Self-seeding fallback if a sample procedure is requested and doesn't exist yet
    if (!procedure && (id === 'sample-1' || id === 'hvac-procedure')) {
      procedure = await prisma.maintenanceProcedure.create({
        data: {
          id,
          name: 'HVAC Quarter-Turn Rooftop Maintenance',
          description: 'Standard preventive quarterly maintenance check for Trane-300 packaged HVAC unit.',
          steps: {
            create: [
              {
                id: 'step-1',
                label: 'Perform standard LOTO (Lockout / Tagout) isolation procedure and verify zero energy.',
                type: 'CHECKBOX',
                isMandatory: true,
                sortOrder: 1,
                attachments: {
                  create: [
                    {
                      id: 'att-1',
                      filename: 'LOTO_SOP_V2.pdf',
                      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                      mimeType: 'application/pdf',
                      size: 15302,
                    }
                  ]
                }
              },
              {
                id: 'step-2',
                label: 'Check fan blower drive belt alignment and inspect for cracks or wear.',
                type: 'CHECKBOX',
                isMandatory: true,
                sortOrder: 2,
                attachments: {
                  create: [
                    {
                      id: 'att-2',
                      filename: 'Blower_Alignment_Guide.pdf',
                      url: 'https://pdfobject.com/pdf/sample.pdf',
                      mimeType: 'application/pdf',
                      size: 24500,
                    }
                  ]
                }
              },
              {
                id: 'step-3',
                label: 'Replace all dirty pre-filters and custom secondary filters with clean MERV 13 standard elements.',
                type: 'CHECKBOX',
                isMandatory: true,
                sortOrder: 3,
                attachments: {
                  create: [
                    {
                      id: 'att-3',
                      filename: 'Filter_Procurement_Spec_Sheet.pdf',
                      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                      mimeType: 'application/pdf',
                      size: 12503,
                    }
                  ]
                }
              },
              {
                id: 'step-4',
                label: 'Verify that the condenser coil cooling fins are clean and clear of clutter debris.',
                type: 'CHECKBOX',
                isMandatory: false,
                sortOrder: 4,
              },
              {
                id: 'step-5',
                label: 'Measure and record supply air outlet temperature after re-energizing system.',
                type: 'TEXT_INPUT',
                isMandatory: true,
                sortOrder: 5,
              }
            ]
          }
        },
        include: {
          steps: {
            orderBy: { sortOrder: 'asc' },
            include: {
              attachments: true,
            },
          },
        },
      })
    }

    if (!procedure) {
      return NextResponse.json({ error: 'Maintenance procedure not found' }, { status: 404 })
    }

    return NextResponse.json(procedure)
  } catch (error) {
    console.error('Error fetching maintenance procedure:', error)
    return NextResponse.json({ error: 'Failed to fetch procedure' }, { status: 500 })
  }
}
