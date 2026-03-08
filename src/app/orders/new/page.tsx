'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Upload, Plus, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

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

  const setField = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const updateItem = (i: number, field: string, value: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        next[i].totalPrice = next[i].quantity * next[i].unitPrice
      }
      return next
    })
  }

  const calcTotals = () => {
    const net = items.reduce((s, i) => s + i.totalPrice, 0)
    const iva = Math.round(net * 0.19)
    setForm(f => ({ ...f, totalNet: net, iva, totalFinal: net + iva }))
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
      setForm(f => ({
        ...f,
        ocNumber: p.ocNumber || '',
        ocDate: p.ocDate ? formatDateInput(p.ocDate) : '',
        buyerName: p.buyerName || '',
        buyerRut: p.buyerRut || '',
        deliveryAddress: p.deliveryAddress || '',
        billingAddress: p.billingAddress || p.deliveryAddress || '',
        totalNet: p.totalNet || 0,
        iva: p.iva || 0,
        totalFinal: p.totalFinal || 0,
        expectedDeliveryDate: p.expectedDeliveryDate ? formatDateInput(p.expectedDeliveryDate) : '',
        observations: [p.ocName, p.observations].filter(Boolean).join(' | ') || '',
        deliveryRestrictions: p.deliveryRestrictions || '',
        requiresValidation: (p.fieldsRequiringValidation?.length || 0) > 0,
      }))
      if (p.products?.length > 0) {
        setItems(p.products.map((prod: any) => ({
          productCode: prod.productCode || '',
          productName: prod.productName || '',
          quantity: prod.quantity || 1,
          unitPrice: prod.unitPrice || 0,
          totalPrice: prod.totalPrice || 0,
          unit: prod.unit || 'UN',
        })))
      }
      setTab('manual')
    } catch {
      setError('Error procesando PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  function formatDateInput(dateStr: string): string {
    const parts = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (parts) return `${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
    return ''
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

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Compra</h1>

      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
        >
          Ingreso Manual
        </button>
        <button
          onClick={() => setTab('pdf')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'pdf' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
        >
          Subir PDF
        </button>
      </div>

      {/* PDF Upload */}
      {tab === 'pdf' && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-blue-300 rounded-xl p-12 text-center cursor-pointer hover:bg-blue-50 transition-colors"
        >
          <input ref={fileRef} type="file" accept=".pdf" onChange={handlePDF} className="hidden" />
          {pdfLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-blue-600">Procesando PDF...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-blue-400" />
              <p className="text-sm font-medium text-gray-700">Arrastra o haz clic para subir OC en PDF</p>
              <p className="text-xs text-gray-400">El sistema extraerá automáticamente los datos</p>
            </div>
          )}
        </div>
      )}

      {/* Validation alert */}
      {pdfResult && pdfResult.fieldsRequiringValidation?.length > 0 && (
        <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Algunos campos requieren validación</p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Revisar: {pdfResult.fieldsRequiringValidation.join(', ')}
            </p>
          </div>
        </div>
      )}

      {pdfResult && pdfResult.fieldsRequiringValidation?.length === 0 && (
        <div className="flex gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">PDF procesado correctamente. Revisa los datos antes de guardar.</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header data */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Datos de la Orden</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'N° OC *', field: 'ocNumber', type: 'text', required: true },
              { label: 'Fecha OC *', field: 'ocDate', type: 'date', required: true },
              { label: 'Organismo Comprador *', field: 'buyerName', type: 'text', required: true, colSpan: true },
              { label: 'RUT Comprador *', field: 'buyerRut', type: 'text', required: true },
              { label: 'Fecha Entrega Esperada', field: 'expectedDeliveryDate', type: 'date', required: false },
            ].map(({ label, field, type, required, colSpan }) => (
              <div key={field} className={colSpan ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type={type}
                  required={required}
                  value={(form as any)[field]}
                  onChange={e => setField(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dirección Despacho *</label>
              <input
                type="text"
                required
                value={form.deliveryAddress}
                onChange={e => setField('deliveryAddress', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dirección Facturación</label>
              <input
                type="text"
                value={form.billingAddress}
                onChange={e => setField('billingAddress', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
              <textarea
                value={form.observations}
                onChange={e => setField('observations', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Restricciones de Entrega</label>
              <textarea
                value={form.deliveryRestrictions}
                onChange={e => setField('deliveryRestrictions', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Productos</h2>
            <button type="button" onClick={() => setItems(i => [...i, emptyProduct()])} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Código</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Producto *</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Unidad</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Cant. *</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">P. Unit *</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Total</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={item.productCode}
                        onChange={e => updateItem(i, 'productCode', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="COD"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        required
                        value={item.productName}
                        onChange={e => updateItem(i, 'productName', e.target.value)}
                        className="w-full min-w-48 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Nombre del producto"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={e => updateItem(i, 'unit', e.target.value)}
                        className="w-16 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity}
                        onChange={e => { updateItem(i, 'quantity', parseFloat(e.target.value) || 0); setTimeout(calcTotals, 0) }}
                        className="w-20 px-2 py-1 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        required
                        min="0"
                        value={item.unitPrice}
                        onChange={e => { updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0); setTimeout(calcTotals, 0) }}
                        className="w-28 px-2 py-1 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-2 pr-2 text-right text-xs font-medium">
                      {formatCurrency(item.totalPrice)}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                        disabled={items.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="space-y-1 text-sm min-w-48">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Neto</span>
                <span className="font-medium">{formatCurrency(form.totalNet)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IVA (19%)</span>
                <span className="font-medium">{formatCurrency(form.iva)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-semibold">Total Final</span>
                <span className="font-bold text-blue-700">{formatCurrency(form.totalFinal)}</span>
              </div>
              <button type="button" onClick={calcTotals} className="text-xs text-blue-500 hover:underline w-full text-right">
                Recalcular totales
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar Orden
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
