// PDF Parser for Chilean Government Purchase Orders
// Extracts structured data from PDF text using regex patterns

export interface ParsedOC {
  ocNumber?: string
  ocDate?: string
  buyerName?: string
  buyerRut?: string
  deliveryAddress?: string
  billingAddress?: string
  products: ParsedProduct[]
  totalNet?: number
  iva?: number
  totalFinal?: number
  expectedDeliveryDate?: string
  observations?: string
  deliveryRestrictions?: string
  fieldsRequiringValidation: string[]
}

export interface ParsedProduct {
  productCode?: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit?: string
}

function extractField(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) return match[1].trim()
  }
  return undefined
}

function parseChileanNumber(str: string): number {
  if (!str) return 0
  // Remove currency symbols, spaces, and convert Chilean format (1.234.567) to number
  const cleaned = str.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

export function parsePDFText(text: string): ParsedOC {
  const result: ParsedOC = {
    products: [],
    fieldsRequiringValidation: [],
  }

  // Normalize text
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // OC Number
  result.ocNumber = extractField(normalizedText, [
    /orden\s+de\s+compra[:\s#N°nro.]*\s*([A-Z0-9-]+)/i,
    /n[°º]\s*oc[:\s]*([A-Z0-9-]+)/i,
    /oc[:\s#]*([0-9]{4,}[-][0-9]+)/i,
    /([0-9]{7,})/,
  ])

  // Date
  result.ocDate = extractField(normalizedText, [
    /fecha[:\s]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
    /(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/,
  ])

  // Buyer name
  result.buyerName = extractField(normalizedText, [
    /organismo\s+comprador[:\s]*([^\n]+)/i,
    /municipalidad\s+de\s+([^\n]+)/i,
    /servicio[:\s]+([^\n]+)/i,
    /ministerio\s+de\s+([^\n]+)/i,
  ])

  // RUT
  result.buyerRut = extractField(normalizedText, [
    /rut[:\s]*(\d{1,2}\.?\d{3}\.?\d{3}[-]\d)/i,
    /(\d{7,8}-[\dkK])/,
  ])

  // Delivery address
  result.deliveryAddress = extractField(normalizedText, [
    /direcci[oó]n\s+despacho[:\s]*([^\n]+)/i,
    /lugar\s+de\s+entrega[:\s]*([^\n]+)/i,
    /despachar\s+en[:\s]*([^\n]+)/i,
  ])

  // Billing address
  result.billingAddress = extractField(normalizedText, [
    /direcci[oó]n\s+facturaci[oó]n[:\s]*([^\n]+)/i,
    /facturar\s+a[:\s]*([^\n]+)/i,
  ])

  // Totals
  const totalNetStr = extractField(normalizedText, [
    /total\s+neto[:\s$]*([0-9.,]+)/i,
    /subtotal[:\s$]*([0-9.,]+)/i,
    /neto[:\s$]*([0-9.,]+)/i,
  ])
  if (totalNetStr) result.totalNet = parseChileanNumber(totalNetStr)

  const ivaStr = extractField(normalizedText, [
    /iva[:\s(19%)\s$]*([0-9.,]+)/i,
    /impuesto[:\s$]*([0-9.,]+)/i,
  ])
  if (ivaStr) result.iva = parseChileanNumber(ivaStr)

  const totalStr = extractField(normalizedText, [
    /total[:\s$]*([0-9.,]+)/i,
    /monto\s+total[:\s$]*([0-9.,]+)/i,
  ])
  if (totalStr) result.totalFinal = parseChileanNumber(totalStr)

  // Expected delivery date
  result.expectedDeliveryDate = extractField(normalizedText, [
    /plazo\s+de\s+entrega[:\s]*([^\n]+)/i,
    /fecha\s+de\s+entrega[:\s]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
    /entregar\s+antes\s+del[:\s]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
  ])

  // Observations
  result.observations = extractField(normalizedText, [
    /observaciones[:\s]*([^\n]+)/i,
    /notas[:\s]*([^\n]+)/i,
  ])

  // Parse product lines - look for table-like structures
  const lines = normalizedText.split('\n')
  const productPatterns = [
    /(\d+)\s+([A-Z0-9\-]+)?\s+(.+?)\s+(\w+)?\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/,
    /(\d+)\s+(.{10,60})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/,
  ]

  for (const line of lines) {
    for (const pattern of productPatterns) {
      const match = line.match(pattern)
      if (match) {
        const qty = parseFloat(match[1])
        if (qty > 0 && qty < 100000) {
          const product: ParsedProduct = {
            quantity: qty,
            productName: (match[3] || match[2] || '').trim(),
            unitPrice: parseChileanNumber(match[match.length - 2]),
            totalPrice: parseChileanNumber(match[match.length - 1]),
            unit: match[4] || 'UN',
          }
          if (product.productName.length > 3) {
            result.products.push(product)
            break
          }
        }
      }
    }
  }

  // Flag fields that couldn't be parsed
  if (!result.ocNumber) result.fieldsRequiringValidation.push('ocNumber')
  if (!result.buyerName) result.fieldsRequiringValidation.push('buyerName')
  if (!result.buyerRut) result.fieldsRequiringValidation.push('buyerRut')
  if (!result.deliveryAddress) result.fieldsRequiringValidation.push('deliveryAddress')
  if (!result.totalFinal) result.fieldsRequiringValidation.push('totalFinal')
  if (result.products.length === 0) result.fieldsRequiringValidation.push('products')

  return result
}
