import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROMPT = `Extrae los datos de esta Orden de Compra de Mercado Público Chile y devuelve SOLO JSON válido, sin texto ni markdown.

Formato de salida:
{
  "ocNumber": string,
  "ocName": string | null,
  "ocDate": "YYYY-MM-DD" | null,
  "sentDate": "YYYY-MM-DD" | null,
  "acceptanceDate": "YYYY-MM-DD" | null,
  "expectedDeliveryDate": "YYYY-MM-DD" | null,
  "buyerName": string,
  "buyerRut": string,
  "buyerInstitution": string | null,
  "buyerPhone": string | null,
  "supplierName": string,
  "supplierRut": string,
  "supplierPhone": string | null,
  "supplierEmail": string | null,
  "deliveryAddress": string,
  "deliveryCity": string | null,
  "deliveryRegion": string | null,
  "billingAddress": string | null,
  "paymentTerms": string | null,
  "currency": "CLP",
  "totalNet": number,
  "discounts": number,
  "iva": number,
  "totalFinal": number,
  "observations": string | null,
  "deliveryRestrictions": string | null,
  "products": [
    {
      "productCode": string,
      "productName": string,
      "quantity": number,
      "unit": string,
      "unitPrice": number,
      "totalPrice": number
    }
  ]
}

Reglas:
- Números chilenos sin formato: 1.234,00 → 1234
- Fechas en formato YYYY-MM-DD
- productCode: número entre paréntesis en columna "Especificaciones Comprador" ej: (4220418) → "4220418"
- productName: columna "Producto", sin texto de región
- Extrae TODOS los productos de la tabla`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfBase64 = buffer.toString('base64')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })

    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            } as Anthropic.DocumentBlockParam,
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json({ parsed, rawText: raw })
  } catch (error: any) {
    console.error('parse-pdf error:', error)
    return NextResponse.json({ error: error?.message || 'Error al procesar PDF' }, { status: 500 })
  }
}
