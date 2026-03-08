'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Upload, Plus, Trash2, AlertCircle, CheckCircle, Loader2, Calculator, SplitSquareHorizontal } from 'lucide-react'

interface ProductRow {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit: string
}

const emptyProduct = (): ProductRow => ({
  productCode: '', productName: '', quantity: 1, unitPrice: 0, totalPrice: 0, unit: 'UN'
})

const INPUT = "w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"

export default function NewOrderPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'manual' | 'pdf'>('manual')
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfResult, setPdfResult] = useState<any>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    ocNumber: '',
    ocDate: '',
    buyerName: '',
    buyerRut: '',
    deliveryAddress: '',
    billingAddress: '',
    totalNet: 0,
    iva: 0,
    totalFinal: 0,
    expectedDeliveryDate: '',
    observations: '',
    deliveryRestrictions: '',
    requiresValidation: false,
  })
  const [items, setItems] = useState<ProductRow[]>([emptyProduct()])
  // Guarda los items originales (con IVA incluido) para poder revertir
  const [itemsOriginal, setItemsOriginal] = useState<ProductRow[] | null>(null)
  const ivaDesglosado = itemsOriginal !== null

  const setField = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const updateItem = (i: number, field: string, value: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        next[i].totalPrice = Math.round(next[i].quantity * next[i].unitPrice)
      }
      return next
    })
  }

  const calcTotals = () => {
    const net = items.reduce((s, i) => s + i.totalPrice, 0)
    const iva = Math.round(net * 0.19)
    setForm(f => ({ ...f, totalNet: net, iva, totalFinal: net + iva }))
  }

  // Toggle: primera vez separa IVA, segunda vez revierte al estado original
  const toggleDesglosarIVA = () => {
    if (ivaDesglosado) {
      // Revertir a precios originales (con IVA incluido)
      setItems(itemsOriginal!)
      const totalOriginal = itemsOriginal!.reduce((s, i) => s + i.totalPrice, 0)
      setForm(f => ({ ...f, totalNet: totalOriginal, iva: 0, totalFinal: totalOriginal }))
      setItemsOriginal(null)
    } else {
      // Guardar estado original y desglosar
      setItemsOriginal(items.map(i => ({ ...i })))
      const desglosados = items.map(item => {
        const precioNeto = Math.round(item.unitPrice / 1.19)
        const totalNeto = Math.round(precioNeto * item.quantity)
        return { ...item, unitPrice: precioNeto, totalPrice: totalNeto }
      })
      setItems(desglosados)
      const totalNeto = desglosados.reduce((s, i) => s + i.totalPrice, 0)
      const iva = Math.round(totalNeto * 0.19)
      setForm(f => ({ ...f, totalNet: totalNeto, iva, totalFinal: totalNeto + iva }))
    }
  }

  // Totales desde suma de productos (precios ya son netos)
  const recalcFromItems = () => {
    const net = items.reduce((s, i) => s + i.totalPrice, 0)
    const iva = Math.round(net * 0.19)
    setForm(f => ({ ...f, totalNet: net, iva, totalFinal: net + iva }))
  }

  function formatDateInput(dateStr: string): string {
    if (!dateStr) return ''
    // Si ya viene en formato YYYY-MM-DD (del parser)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    const parts = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (parts) return `${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
    return ''
  }

  const handlePDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfLoading(true)
    setError('')
    const fd = new FormData()
    fd.append('pdf', file)
    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      const p = data.parsed

      setPdfResult(p)
      setItemsOriginal(null) // resetear toggle al cargar nuevo PDF

      // Poblar productos primero
      const parsedItems: ProductRow[] = p.products?.length > 0
        ? p.products.map((prod: any) => ({
            productCode: prod.productCode || '',
            productName: prod.productName || '',
            quantity: Number(prod.quantity) || 1,
            unitPrice: Number(prod.unitPrice) || 0,
            totalPrice: Number(prod.totalPrice) || Math.round((Number(prod.quantity) || 1) * (Number(prod.unitPrice) || 0)),
            unit: prod.unit || 'UN',
          }))
        : [emptyProduct()]
      setItems(parsedItems)

      // Calcular neto desde suma de productos si no viene del PDF
      const sumaProductos = parsedItems.reduce((s, i) => s + i.totalPrice, 0)
      const totalNet = p.totalNet || sumaProductos
      const totalFinal = p.totalFinal || (totalNet + Math.round(totalNet * 0.19))
      const iva = p.iva ?? (totalFinal - totalNet)

      setForm(f => ({
        ...f,
        ocNumber: p.ocNumber || '',
        ocDate: formatDateInput(p.ocDate || ''),
        buyerName: p.buyerName || '',
        buyerRut: p.buyerRut || '',
        deliveryAddress: p.deliveryAddress || '',
        billingAddress: p.billingAddress || p.deliveryAddress || '',
        totalNet,
        iva,
        totalFinal,
        expectedDeliveryDate: formatDateInput(p.expectedDeliveryDate || ''),
        observations: [p.ocName, p.observations].filter(Boolean).join(' | ') || '',
        deliveryRestrictions: p.deliveryRestrictions || '',
        requiresValidation: (p.fieldsRequiringValidation?.length || 0) > 0,
      }))

      setTab('manual')
    } catch {
      setError('Error procesando PDF')
    } finally {
      setPdfLoading(false)
      // reset input para permitir subir el mismo archivo de nuevo
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      router.push(`/orders/${data.id}`)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const sumItems = items.reduce((s, i) => s + i.totalPrice, 0)

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Compra</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('manual')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}>
          Ingreso Manual
        </button>
        <button onClick={() => setTab('pdf')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'pdf' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}>
          Subir PDF
        </button>
      </div>

      {/* PDF Upload zone */}
      {tab === 'pdf' && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-blue-300 rounded-xl p-12 text-center cursor-pointer hover:bg-blue-50 transition-colors"
        >
          <input ref={fileRef} type="file" accept=".pdf" onChange={handlePDF} className="hidden" />
          {pdfLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-blue-600 font-medium">Leyendo OC...</p>
              <p className="text-xs text-gray-400">Extrayendo campos, productos y precios</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-blue-400" />
              <p className="text-sm font-medium text-gray-700">Haz clic o arrastra el PDF de la OC aquí</p>
              <p className="text-xs text-gray-400">Extrae automáticamente: organismo, RUT, dirección, productos, precios y totales</p>
            </div>
          )}
        </div>
      )}

      {/* Alertas PDF */}
      {pdfResult && pdfResult.fieldsRequiringValidation?.length > 0 && (
        <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Campos que requieren revisión manual</p>
            <p className="text-xs text-yellow-600 mt-0.5">{pdfResult.fieldsRequiringValidation.join(', ')}</p>
          </div>
        </div>
      )}
      {pdfResult && pdfResult.fieldsRequiringValidation?.length === 0 && (
        <div className="flex gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">PDF leído correctamente — {items.length} producto(s) cargados. Revisa y guarda.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Datos de la orden ── */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Datos de la Orden</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>N° OC *</label>
              <input type="text" required value={form.ocNumber} onChange={e => setField('ocNumber', e.target.value)} className={INPUT} placeholder="1422825-761-CM25" />
            </div>
            <div>
              <label className={LABEL}>Fecha OC *</label>
              <input type="date" required value={form.ocDate} onChange={e => setField('ocDate', e.target.value)} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Organismo Comprador *</label>
              <input type="text" required value={form.buyerName} onChange={e => setField('buyerName', e.target.value)} className={INPUT} placeholder="SERVICIO NACIONAL DE SALUD HOSPITAL CARLOS VAN BUR" />
            </div>
            <div>
              <label className={LABEL}>RUT Comprador *</label>
              <input type="text" required value={form.buyerRut} onChange={e => setField('buyerRut', e.target.value)} className={INPUT} placeholder="61.602.054-4" />
            </div>
            <div>
              <label className={LABEL}>Fecha Entrega Esperada</label>
              <input type="date" value={form.expectedDeliveryDate} onChange={e => setField('expectedDeliveryDate', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Dirección Despacho *</label>
              <input type="text" required value={form.deliveryAddress} onChange={e => setField('deliveryAddress', e.target.value)} className={INPUT} placeholder="San Ignacio N°783, Valparaíso" />
            </div>
            <div>
              <label className={LABEL}>Dirección Facturación</label>
              <input type="text" value={form.billingAddress} onChange={e => setField('billingAddress', e.target.value)} className={INPUT} placeholder="San Ignacio 783, Valparaíso" />
            </div>
            <div>
              <label className={LABEL}>Observaciones</label>
              <textarea value={form.observations} onChange={e => setField('observations', e.target.value)} rows={3} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Restricciones / Horarios Entrega</label>
              <textarea value={form.deliveryRestrictions} onChange={e => setField('deliveryRestrictions', e.target.value)} rows={3} className={INPUT} placeholder="Lunes a jueves 08:30/16:00 hrs..." />
            </div>
          </div>
        </div>

        {/* ── Productos ── */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              Productos
              {items.length > 1 && <span className="ml-2 text-xs font-normal text-gray-400">({items.length} líneas)</span>}
            </h2>
            <button type="button" onClick={() => setItems(i => [...i, emptyProduct()])}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="h-3.5 w-3.5" /> Agregar producto
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-28">Código</th>
                  <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Producto *</th>
                  <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 w-16">Unidad</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 w-20">Cant. *</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 w-32">Precio Unit. *</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 w-32">Total línea</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.productCode}
                        onChange={e => updateItem(i, 'productCode', e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="4220418" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" required value={item.productName}
                        onChange={e => updateItem(i, 'productName', e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Nombre del producto" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={item.unit}
                        onChange={e => updateItem(i, 'unit', e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" required min="1" value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" required min="0" value={item.unitPrice}
                        onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                      {formatCurrency(item.totalPrice)}
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                        disabled={items.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-20">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totales ── */}
          <div className="flex justify-between items-end pt-2 border-t">

            {/* Botones de cálculo */}
            <div className="flex gap-2">
              <button type="button" onClick={recalcFromItems}
                className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors">
                <Calculator className="h-3.5 w-3.5" />
                Recalcular totales
              </button>
              <button type="button" onClick={toggleDesglosarIVA}
                title={ivaDesglosado ? 'Revertir a precios originales con IVA incluido' : 'Separa el IVA de los precios: precio neto = precio / 1.19'}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                  ivaDesglosado
                    ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                    : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200'
                }`}>
                <SplitSquareHorizontal className="h-3.5 w-3.5" />
                {ivaDesglosado ? 'Revertir IVA' : 'Desglosar IVA'}
              </button>
            </div>

            {/* Resumen de totales */}
            <div className="space-y-1 text-sm w-64">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal productos</span>
                <span className="font-medium">{formatCurrency(sumItems)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total Neto</span>
                <input type="number" value={form.totalNet}
                  onChange={e => setForm(f => ({ ...f, totalNet: parseFloat(e.target.value) || 0 }))}
                  className="w-32 px-2 py-0.5 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">IVA 19%</span>
                <input type="number" value={form.iva}
                  onChange={e => {
                    const iva = parseFloat(e.target.value) || 0
                    setForm(f => ({ ...f, iva, totalFinal: f.totalNet + iva }))
                  }}
                  className="w-32 px-2 py-0.5 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-bold text-gray-800">Total Final</span>
                <span className="font-bold text-blue-700 text-base">{formatCurrency(form.totalNet + form.iva)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar Orden de Compra
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
