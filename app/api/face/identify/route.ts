import { NextRequest, NextResponse } from 'next/server'

// Note: The simplified face service doesn't have an identify endpoint
// since CMMS always knows the user. For future use if needed, uncomment.

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Identification endpoint not available in simplified mode' },
    { status: 501 }
  )
}
