/**
 * Parser para Órdenes de Compra del Estado de Chile (Mercado Público)
 * Basado en el formato real de OC de mercadopublico.cl
 *
 * Estructura del documento:
 * - Encabezado: RUT, Demandante, Dirección, Unidad de Compra, Fecha, Teléfono
 * - Cuerpo: SEÑOR(ES), RUT proveedor, Nombre OC, Fecha entrega, Dir. despacho, Dir. factura
 * - Tabla de productos: Código/ID Licitación, Producto, Cantidad, Esp. Comprador (con código),
 *                       Esp. Proveedor (con dirección), Precio Unitario, Descuento, Cargos, Valor Total
 * - Totales: Neto, Dcto, Subtotal, 19% IVA, Imp. específico, Total
 * - Observaciones y Observaciones del despacho
 */

export interface ParsedOC {
  ocNumber?: string
  ocDate?: string
  buyerName?: string           // Demandante (organismo del Estado)
  buyerRut?: string            // RUT del organismo comprador
  supplierName?: string        // Proveedor (nuestra empresa)
  supplierRut?: string         // RUT del proveedor
  deliveryAddress?: string     // Direcciones de despacho
  billingAddress?: string      // Dirección envío factura
  paymentTerms?: string        // Forma de pago
  unitArea?: string            // Unidad de compra
  ocName?: string              // Nombre de la orden de compra
  totalNet?: number
  iva?: number
  totalFinal?: number
  expectedDeliveryDate?: string
  observations?: string
  deliveryRestrictions?: string  // Observaciones del despacho (horarios, restricciones)
  products: ParsedProduct[]
  fieldsRequiringValidation: string[]
}

export interface ParsedProduct {
  productCode?: string   // Código en paréntesis: (4220418)
  licitacionId?: string  // ID Licitación CM: 2239-9-LR24
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit?: string
  discount?: number
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function extract(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

// Convierte número chileno "1.234.567" o "1.234.567,00" a float
function parseChileanNumber(str: string): number {
  if (!str) return 0
  const clean = str.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  return parseFloat(clean) || 0
}

function normalizeDate(str: string): string {
  const m = str.match(/(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return str
}

function cleanProductName(name: string): string {
  return name
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/;.*$/, '')
    .replace(/Regi[oó]n de.*/i, '')
    .replace(/UNIDAD [IVX]+ REGI[OÓ]N\s*$/i, '')
    .trim()
}

export function parsePDFText(rawText: string): ParsedOC {
  const text = normalize(rawText)
  const result: ParsedOC = {
    products: [],
    fieldsRequiringValidation: [],
  }

  // ─── N° OC ───────────────────────────────────────────────────────────────
  // Formato Mercado Público: "1422825-761-CM25"
  result.ocNumber = extract(text, [
    /N[°º]\s*:\s*(\d{5,}-\d{2,}-[A-Z]{2}\d+)/i,
    /ORDEN DE COMPRA\s+N[°º]\s*:\s*(\S+)/i,
    /N[°º]\s*(\d{5,}-\d{2,}-[A-Z]{2}\d+)/i,
    /(\d{6,}-\d{3,}-[A-Z]{2}\d+)/,
  ])

  // ─── Fecha OC ─────────────────────────────────────────────────────────────
  const rawDate = extract(text, [
    /Fecha Envio OC[\.\s]*:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /Fecha\s+OC\s*:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})/,
  ])
  if (rawDate) result.ocDate = normalizeDate(rawDate)

  // ─── Organismo comprador (Demandante) ─────────────────────────────────────
  result.buyerName = extract(text, [
    /Demandante\s*:\s*([A-ZÁÉÍÓÚÑ][^\n]{5,})/,
    /SEÑOR\s*\(ES\)\s*:\s*([^\n]+)/i,
  ])
  if (result.buyerName) {
    result.buyerName = result.buyerName
      .replace(/Unidad de Compra.*/i, '')
      .split('\n')[0]
      .trim()
  }

  // ─── RUTs (el primero es el comprador, el segundo es el proveedor) ────────
  const rutMatches = [...text.matchAll(/(\d{1,2}\.?\d{3}\.?\d{3}[-–][\dkK])/g)]
  if (rutMatches.length >= 1) result.buyerRut = rutMatches[0][1]
  if (rutMatches.length >= 2) result.supplierRut = rutMatches[1][1]

  // ─── Proveedor (nuestra empresa) ──────────────────────────────────────────
  result.supplierName = extract(text, [
    /SEÑOR\s*\(ES\)\s*:\s*([^\n]+)/i,
    /Se[ñn]or\s*\(es\)\s*:\s*([^\n]+)/i,
  ])

  // ─── Nombre de la OC ──────────────────────────────────────────────────────
  result.ocName = extract(text, [
    /NOMBRE ORDEN DE COMPRA\s*:\s*([^\n]+)/i,
    /Nombre\s+OC\s*:\s*([^\n]+)/i,
  ])

  // ─── Unidad de compra ─────────────────────────────────────────────────────
  result.unitArea = extract(text, [/Unidad de Compra\s*:\s*([^\n]+)/i])

  // ─── Fecha entrega productos ──────────────────────────────────────────────
  const rawDelivery = extract(text, [
    /FECHA ENTREGA PRODUCTOS\s*:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /Fecha\s+entrega\s*:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i,
  ])
  if (rawDelivery) result.expectedDeliveryDate = normalizeDate(rawDelivery)

  // ─── Dirección despacho ───────────────────────────────────────────────────
  result.deliveryAddress = extract(text, [
    /DIRECCIONES DE DESPACHO\s*:\s*[•·\-\*]?\s*([^\n]+)/i,
    /Direcci[oó]n\s+de\s+despacho\s*:\s*([^\n]+)/i,
    /Lugar\s+de\s+entrega\s*:\s*([^\n]+)/i,
  ])

  // ─── Dirección factura ────────────────────────────────────────────────────
  result.billingAddress = extract(text, [
    /DIRECCION DE ENVIO FACTURA\s*:\s*([^\n]+)/i,
    /Direcci[oó]n\s+facturaci[oó]n\s*:\s*([^\n]+)/i,
  ])

  // ─── Forma de pago ────────────────────────────────────────────────────────
  result.paymentTerms = extract(text, [
    /FORMA DE PAGO\s*:\s*([^\n]+)/i,
    /Forma\s+de\s+pago\s*:\s*([^\n]+)/i,
  ])

  // ─── Totales ──────────────────────────────────────────────────────────────
  const netoStr = extract(text, [
    /\bNeto\b\s*\$?\s*([\d.,]+)/i,
    /Total\s+Neto\s*\$?\s*([\d.,]+)/i,
  ])
  if (netoStr) result.totalNet = parseChileanNumber(netoStr)

  const ivaStr = extract(text, [
    /19%\s*IVA\s*\$?\s*([\d.,]+)/i,
    /\bIVA\b\s*\$?\s*([\d.,]+)/i,
  ])
  if (ivaStr) result.iva = parseChileanNumber(ivaStr)

  const totalStr = extract(text, [
    /\bTotal\b\s*\$\s*([\d.,]+)/i,
    /Total\s+Final\s*\$?\s*([\d.,]+)/i,
  ])
  if (totalStr) result.totalFinal = parseChileanNumber(totalStr)

  if (result.totalNet && result.totalFinal && !result.iva) {
    result.iva = result.totalFinal - result.totalNet
  }
  if (!result.totalNet && result.totalFinal) {
    result.totalNet = result.totalFinal
    result.iva = 0
  }

  // ─── Observaciones ────────────────────────────────────────────────────────
  result.observations = extract(text, [
    /\nObservaciones\s*:\s*\n?([\s\S]+?)(?=\nObservaciones del despacho:|\nFuente Financiamiento|\nDerechos del Proveedor)/i,
  ])
  if (result.observations) result.observations = result.observations.trim().slice(0, 500)

  // ─── Restricciones de entrega (Observaciones del despacho) ────────────────
  result.deliveryRestrictions = extract(text, [
    /Observaciones del despacho\s*:\s*\n?([\s\S]+?)(?=\nDerechos del Proveedor|\nEspecificaciones|$)/i,
  ])
  if (result.deliveryRestrictions) result.deliveryRestrictions = result.deliveryRestrictions.trim().slice(0, 500)

  // ─── PRODUCTOS ────────────────────────────────────────────────────────────
  result.products = parseProducts(text)

  // ─── Validación ───────────────────────────────────────────────────────────
  if (!result.ocNumber) result.fieldsRequiringValidation.push('ocNumber')
  if (!result.buyerName) result.fieldsRequiringValidation.push('buyerName')
  if (!result.buyerRut) result.fieldsRequiringValidation.push('buyerRut')
  if (!result.deliveryAddress) result.fieldsRequiringValidation.push('deliveryAddress')
  if (!result.totalFinal) result.fieldsRequiringValidation.push('totalFinal')
  if (result.products.length === 0) result.fieldsRequiringValidation.push('products')

  return result
}

/**
 * Extrae productos de la tabla de Mercado Público.
 *
 * Formato de cada fila en el texto extraído del PDF:
 *   [ID licitación ej: "2239-9-LR24"]
 *   [NOMBRE PRODUCTO (puede ser varias líneas en mayúsculas)]
 *   [CANTIDAD]  [código entre paréntesis (XXXXXXX) seguido de descripción]
 *   [descripción proveedor con dirección y ;]
 *   [PRECIO UNITARIO]
 *   [0,00]  <- descuento
 *   [0,00]  <- cargos
 *   [VALOR TOTAL]
 *
 * El código del producto siempre aparece entre paréntesis: (4220418)
 * El precio tiene formato chileno: 2.446,00 o 2446
 * El total también: 48.920 o 48920
 */
function parseProducts(text: string): ParsedProduct[] {
  const products: ParsedProduct[] = []
  const seen = new Set<string>()

  // Estrategia principal: buscar "(CODIGO) descripción ... precio 0,00 0,00 total"
  // Esto cubre el caso donde pdf-parse junta bien las líneas
  const pattern1 = /(\d{1,4})\s+\((\d{6,8})\)\s+([^\n(]{5,})(?:;[^\n]*)?\s+([\d.]{3,}[,\d]*)\s+0[,\.]00\s+0[,\.]00\s+([\d.]{3,}[,\d]*)/gm
  let m: RegExpExecArray | null
  while ((m = pattern1.exec(text)) !== null) {
    const qty = parseFloat(m[1])
    const code = m[2]
    const name = cleanProductName(m[3])
    const unitPrice = parseChileanNumber(m[4])
    const total = parseChileanNumber(m[5])
    const key = `${code}-${qty}`
    if (qty > 0 && qty < 100000 && name.length > 3 && unitPrice > 0 && !seen.has(key)) {
      seen.add(key)
      products.push({ productCode: code, productName: name, quantity: qty, unitPrice, totalPrice: total || qty * unitPrice, unit: 'UN', discount: 0 })
    }
  }

  if (products.length > 0) return products

  // Estrategia 2: buscar códigos entre paréntesis y reconstruir
  // En PDFs donde el texto no se extrae en orden lineal
  const codeMatches = [...text.matchAll(/\((\d{6,8})\)\s+([A-ZÁÉÍÓÚÑ][^\n;(]{5,})/g)]
  for (const cm of codeMatches) {
    const code = cm[1]
    const nameRaw = cleanProductName(cm[2])
    if (nameRaw.length < 4) continue

    // Buscar precio y cantidad en el contexto alrededor
    const idx = cm.index ?? 0
    const context = text.slice(Math.max(0, idx - 300), idx + 300)

    // Cantidad: número solo en línea previa
    const qtyM = context.slice(0, context.indexOf(cm[0])).match(/\b(\d{1,4})\s*$/)
    const qty = qtyM ? parseInt(qtyM[1]) : 1

    // Precio: primer número con formato chileno después del nombre
    const after = context.slice(context.indexOf(cm[0]) + cm[0].length)
    const priceM = after.match(/([\d.]{3,}[,\d]*)\s+0[,\.]00\s+0[,\.]00\s+([\d.]{3,}[,\d]*)/)

    if (priceM) {
      const unitPrice = parseChileanNumber(priceM[1])
      const total = parseChileanNumber(priceM[2])
      const key = `${code}-${qty}`
      if (!seen.has(key) && unitPrice > 0) {
        seen.add(key)
        products.push({ productCode: code, productName: nameRaw, quantity: qty, unitPrice, totalPrice: total || qty * unitPrice, unit: 'UN' })
      }
    }
  }

  return products
}
