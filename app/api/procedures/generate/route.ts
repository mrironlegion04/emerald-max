import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { getCurrentUser } from '@/lib/session'

const api_key = process.env.GEMINI_API_KEY

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!api_key) {
      return NextResponse.json({
        error: 'GEMINI_API_KEY environment variable is not configured. Please add it in your Settings > Secrets.'
      }, { status: 500 })
    }

    const { name, description, assetName, categoryName } = await req.json()

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Procedure name is required for generation.' }, { status: 400 })
    }

    const ai = new GoogleGenAI({
      apiKey: api_key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })

    const prompt = `
      You are an expert maintenance engineer. Generate a professional step-by-step Maintenance Procedure checklist inspired by MaintainX.
      
      Procedure Details:
      - Name: ${name}
      - Description: ${description || 'No description provided.'}
      ${assetName ? `- Target Asset: ${assetName}` : ''}
      ${categoryName ? `- Asset Category: ${categoryName}` : ''}

      Generate 5 to 10 logical, practical, and highly realistic maintenance steps for this procedure. 
      Vary the types of steps among the following supported MaintainX-style inputs where appropriate:
      - 'CHECKBOX': Standard checklist verification items (e.g., "Verify discharge valve is fully open").
      - 'TEXT_INPUT': Recording text comments or observations (e.g., "Describe the physical state of the pump seal").
      - 'NUMBER_INPUT': Recording raw values or readings (e.g., "Measure and record pump casing temperature in °C").
      - 'SINGLE_SELECT': Selecting a state from mutually exclusive options (e.g., "Select oil level condition" with options like "Low", "Full", "Overfilled"). Must provide options in the 'options' field.
      - 'INSPECTION': Pass/Fail / Flag inspection verification (e.g., "Inspect visual alignment of drive couplings").
      - 'SIGNATURE': Mandatory signature/sign-off task at the end of the procedure (e.g., "Lead technician sign-off").

      Each step must have a clear, descriptive label, a defined type, a boolean indicating if it's mandatory, and an optional list of string options (primarily for SINGLE_SELECT).
    `

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              description: 'List of generated maintenance procedure steps',
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: 'Clear action-oriented instruction or check' },
                  type: { 
                    type: Type.STRING, 
                    description: 'The MaintainX input step type',
                    enum: ['CHECKBOX', 'TEXT_INPUT', 'NUMBER_INPUT', 'SINGLE_SELECT', 'INSPECTION', 'SIGNATURE']
                  },
                  isMandatory: { type: Type.BOOLEAN, description: 'Whether completing this step is required' },
                  options: { 
                    type: Type.ARRAY, 
                    description: 'Selectable options for SINGLE_SELECT type (empty for other types)',
                    items: { type: Type.STRING } 
                  }
                },
                required: ['label', 'type', 'isMandatory', 'options']
              }
            }
          },
          required: ['steps']
        }
      }
    })

    const text = response.text
    if (!text) {
      throw new Error('Gemini returned an empty response')
    }

    const payload = JSON.parse(text)
    return NextResponse.json(payload)

  } catch (error: any) {
    console.error('Error generating procedure steps:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate procedure steps.' }, { status: 500 })
  }
}
