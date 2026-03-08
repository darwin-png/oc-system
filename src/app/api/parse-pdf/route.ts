import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parsePDFText } from '@/lib/pdf-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un extractor de Órdenes de Compra de Mercado Público Chile.
Lee el PDF adjunto y devuelve SOLO un JSON válido con todos los datos extraídos.
Reglas:
- Números chilenos: 1.234.567,00 → 1234567 (punto=miles, coma=decimal, resultado sin formato)
- Fechas DD/MM/YYYY → YYYY-MM-DD
- Devuelve únicamente el JSON, sin texto adicional ni markdown`

const USER_PROMPT = `Lee esta Orden de Compra y extrae todos los datos. Devuelve SOLO JSON con esta estructura exacta:

{
  "ocNumber": "N° de la OC ej: 1422825-761-CM25",
  "ocName": "NOMBRE ORDEN DE COMPRA o null",
  "ocDate": "YYYY-MM-DD o null",
  "sentDate": "Fecha Envio OC en YYYY-MM-DD o null",
  "acceptanceDate": "YYYY-MM-DD o null",
  "expectedDeliveryDate": "FECHA ENTREGA PRODUCTOS en YYYY-MM-DD o null",
  "buyerName": "Demandante completo",
  "buyerRut": "RUT del comprador ej: 61.602.054-4",
  "buyerInstitution": "Unidad de Compra o null",
  "buyerPhone": "Teléfono del comprador o null",
  "supplierName": "SEÑOR(ES) nombre del proveedor",
  "supplierRut": "RUT proveedor ej: 77.082.051-0",
  "supplierContact": "null",
  "supplierPhone": "Teléfono o null",
  "supplierEmail": "email factura o null",
  "deliveryAddress": "DIRECCIONES DE DESPACHO completa",
  "deliveryCity": "ciudad de despacho o null",
  "deliveryRegion": "región de despacho o null",
  "billingAddress": "DIRECCION DE ENVIO FACTURA o null",
  "paymentTerms": "FORMA DE PAGO o null",
  "currency": "CLP",
  "totalNet": 5192679,
  "discounts": 0,
  "iva": 0,
  "totalFinal": 5192679,
  "observations": "texto de Observaciones o null",
  "deliveryRestrictions": "texto de Observaciones del despacho o null",
  "products": [
    {
      "productCode": "código sin paréntesis ej: 4220418",
      "productName": "nombre completo del producto de la columna Producto, SIN sufijos de región",
      "quantity": 20,
      "unit": "UNIDAD",
      "unitPrice": 2446,
      "totalPrice": 48920,
      "discount": 0
    }
  ],
  "fieldsRequiringValidation": []
}

REGLAS CRÍTICAS:
- Extrae TODOS los productos de la tabla de la OC (lee ambas páginas si las hay)
- El código del producto está entre paréntesis en la columna "Especificaciones Comprador": (4220418) → "4220418"
- El nombre del producto viene de la columna "Producto", sin incluir "UNIDAD V REGIÓN" ni región
- Los números NO deben tener puntos de miles ni comas decimales en el JSON: 2.446,00 → 2446
- unitPrice × quantity debe ser igual a totalPrice
- Neto, IVA y Total se leen de la tabla de totales al final del documento`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfBase64 = buffer.toString('base64')

    // Extracción directa con Claude leyendo el PDF (igual que un humano lo leería)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey })
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: pdfBase64,
                  },
                } as Anthropic.DocumentBlockParam,
                {
                  type: 'text',
                  text: USER_PROMPT,
                },
              ],
            },
          ],
        })

        const raw = (msg.content[0] as { type: string; text: string }).text
        const jsonMatch =
          raw.match(/```json\n?([\s\S]+?)\n?```/) ||
          raw.match(/```\n?([\s\S]+?)\n?```/) ||
          raw.match(/(\{[\s\S]+\})/)
        const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : raw
        const parsed = JSON.parse(jsonStr)

        // Extraer texto para el panel debug (fallback a texto vacío si pdf-parse no está disponible)
        let rawText = ''
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require('pdf-parse/lib/pdf-parse.js')
          rawText = (await pdfParse(buffer)).text
        } catch { /* no crítico */ }

        return NextResponse.json({ parsed, rawText })
      } catch (claudeError) {
        console.error('Claude API error, usando parser regex como fallback:', claudeError)
      }
    } else {
      console.warn('ANTHROPIC_API_KEY no configurada, usando parser regex')
    }

    // Fallback: parser regex sobre texto extraído
    let text = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      text = (await pdfParse(buffer)).text
    } catch {
      return NextResponse.json({ error: 'No se pudo leer el PDF' }, { status: 400 })
    }
    const parsed = parsePDFText(text)
    return NextResponse.json({ parsed, rawText: text })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al procesar PDF' }, { status: 500 })
  }
}
