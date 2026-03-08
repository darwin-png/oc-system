import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parsePDFText } from '@/lib/pdf-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un extractor de Órdenes de Compra de Mercado Público Chile.
Dado el texto de una OC, devuelve SOLO JSON válido con la estructura exacta indicada.
Reglas:
- Números chilenos: 1.234.567,00 → 1234567.00 (punto=miles, coma=decimal)
- Fechas DD/MM/YYYY → YYYY-MM-DD
- Devuelve únicamente el JSON, sin explicaciones ni markdown`

function buildPrompt(text: string): string {
  return `Extrae todos los datos de esta Orden de Compra chilena. Devuelve SOLO JSON válido:

{
  "ocNumber": "número OC ej: 2239-9-LR24",
  "ocName": "nombre de la orden o null",
  "ocDate": "YYYY-MM-DD o null",
  "sentDate": "YYYY-MM-DD o null",
  "acceptanceDate": "YYYY-MM-DD o null",
  "expectedDeliveryDate": "YYYY-MM-DD o null",
  "buyerName": "nombre demandante",
  "buyerRut": "RUT comprador ej: 61.603.203-k",
  "buyerInstitution": "unidad de compra o null",
  "supplierName": "nombre proveedor (SEÑOR(ES))",
  "supplierRut": "RUT proveedor",
  "supplierContact": "contacto o null",
  "supplierPhone": "teléfono o null",
  "supplierEmail": "email o null",
  "deliveryAddress": "dirección de despacho",
  "deliveryCity": "ciudad o null",
  "deliveryRegion": "región o null",
  "billingAddress": "dirección factura o null",
  "paymentTerms": "forma de pago o null",
  "currency": "CLP",
  "totalNet": 1000000,
  "discounts": 0,
  "iva": 190000,
  "totalFinal": 1190000,
  "observations": "observaciones o null",
  "deliveryRestrictions": "restricciones despacho o null",
  "products": [
    {
      "productCode": "código sin paréntesis ej: 4220418",
      "productName": "nombre completo del producto SIN código ni sufijos de región",
      "quantity": 20,
      "unit": "UNIDAD",
      "unitPrice": 2239,
      "totalPrice": 44780,
      "discount": 0
    }
  ],
  "fieldsRequiringValidation": []
}

REGLAS CRÍTICAS PARA PRODUCTOS:
- Los códigos de producto aparecen entre paréntesis: (4220418) → productCode: "4220418"
- Extrae TODOS los productos de la tabla (puede haber 1 o muchos)
- Convierte números chilenos: 2.239,00 → 2239 | 44.780,00 → 44780
- El nombre del producto NO debe incluir la región ni el código
- unitPrice es el precio por unidad, totalPrice es quantity × unitPrice
- Si hay descuento, totalPrice puede ser menor que quantity × unitPrice

TEXTO DE LA OC:
${text.slice(0, 14000)}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    let text = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const data = await pdfParse(buffer)
      text = data.text
    } catch (parseError) {
      console.error('PDF parse error:', parseError)
      return NextResponse.json({ error: 'No se pudo leer el PDF' }, { status: 400 })
    }

    // Extracción con Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey })
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildPrompt(text) }],
        })

        const raw = (msg.content[0] as { type: string; text: string }).text
        // Extraer JSON aunque venga con markdown o texto extra
        const jsonMatch =
          raw.match(/```json\n?([\s\S]+?)\n?```/) ||
          raw.match(/```\n?([\s\S]+?)\n?```/) ||
          raw.match(/(\{[\s\S]+\})/)
        const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : raw
        const parsed = JSON.parse(jsonStr)
        return NextResponse.json({ parsed, rawText: text })
      } catch (claudeError) {
        console.error('Claude API error, usando parser regex como fallback:', claudeError)
      }
    } else {
      console.warn('ANTHROPIC_API_KEY no configurada, usando parser regex')
    }

    // Fallback: parser regex
    const parsed = parsePDFText(text)
    return NextResponse.json({ parsed, rawText: text })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al procesar PDF' }, { status: 500 })
  }
}
