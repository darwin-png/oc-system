'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import { OrderStatus } from '@/types'
import {
  ArrowLeft, CheckCircle, AlertTriangle, Plus, X, Truck, PackageCheck, ChevronDown, ChevronUp
} from 'lucide-react'

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  INGRESADA: 'VALIDADA',
  VALIDADA: 'PENDIENTE_CALENDARIZAR',
  PENDIENTE_CALENDARIZAR: 'CALENDARIZADA',
  CALENDARIZADA: 'EN_PREPARACION',
  EN_PREPARACION: 'PREPARADA',
  PREPARADA: 'EN_RUTA',
  EN_RUTA: 'ENTREGADA',
  PARCIALMENTE_ENTREGADA: 'EN_RUTA',
}

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  VALIDADA: 'Validar OC',
  PENDIENTE_CALENDARIZAR: 'Pasar a Pendiente',
  CALENDARIZADA: 'Calendarizar',
  EN_PREPARACION: 'Iniciar Preparación',
  PREPARADA: 'Marcar Preparada',
  EN_RUTA: 'Salir a Ruta',
  ENTREGADA: 'Confirmar Entrega',
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [delivery, setDelivery] = useState({ scheduledDate: '', transportist: '', route: '', notes: '', items: [] as any[] })
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null)
  const [confirmItems, setConfirmItems] = useState<any[]>([])
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null)

  useEffect(() => { fetchOrder() }, [params.id])

  async function fetchOrder() {
    const res = await fetch(`/api/orders/${params.id}`)
    const data = await res.json()
    setOrder(data)
    setLoading(false)
    if (data.items) {
      setDelivery(d => ({
        ...d,
        items: data.items.map((i: any) => ({ orderItemId: i.id, quantity: i.pendingQty, productName: i.productName, max: i.pendingQty }))
      }))
    }
  }

  async function advanceStatus() {
    const next = NEXT_STATUS[order.status as OrderStatus]
    if (!next) return
    setUpdating(true)
    await fetch(`/api/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    await fetchOrder()
    setUpdating(false)
  }

  async function createDelivery() {
    setUpdating(true)
    const res = await fetch(`/api/orders/${order.id}/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...delivery,
        items: delivery.items.filter(i => i.quantity > 0),
      }),
    })
    if (res.ok) {
      setShowDeliveryForm(false)
      await fetchOrder()
    }
    setUpdating(false)
  }

  async function markEnRoute(deliveryId: string) {
    setUpdating(true)
    await fetch(`/api/orders/${order.id}/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'EN_RUTA' }),
    })
    await fetchOrder()
    setUpdating(false)
  }

  function startConfirm(d: any) {
    setConfirmingDelivery(d.id)
    setConfirmItems(d.items.map((item: any) => ({
      deliveryItemId: item.id,
      productName: order.items?.find((oi: any) => oi.id === item.orderItemId)?.productName || item.orderItemId,
      quantity: item.quantity,
      delivered: item.quantity,
      missing: 0,
    })))
  }

  async function confirmDelivery(deliveryId: string) {
    setUpdating(true)
    await fetch(`/api/orders/${order.id}/deliveries/${deliveryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ENTREGADA',
        deliveredDate: new Date().toISOString(),
        items: confirmItems,
      }),
    })
    setConfirmingDelivery(null)
    await fetchOrder()
    setUpdating(false)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  if (!order || order.error) return <div className="p-6 text-red-600">Orden no encontrada</div>

  const totalDelivered = order.items?.reduce((s: number, i: any) => s + i.deliveredQty, 0) || 0
  const totalQty = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
  const progress = totalQty > 0 ? Math.round((totalDelivered / totalQty) * 100) : 0
  const nextStatus = NEXT_STATUS[order.status as OrderStatus]

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{order.ocNumber}</h1>
              <OrderStatusBadge status={order.status} />
              {order.requiresValidation && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Requiere validación
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{order.buyerName} · {order.buyerRut}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {order.status !== 'PENDIENTE_STOCK' && order.status !== 'CERRADA' && nextStatus && (
            <button
              onClick={advanceStatus}
              disabled={updating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              <CheckCircle className="h-4 w-4" />
              {ACTION_LABELS[nextStatus] || `→ ${STATUS_LABELS[nextStatus]}`}
            </button>
          )}
          <button
            onClick={() => setShowDeliveryForm(!showDeliveryForm)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Entrega
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 mb-1">Fecha OC</p>
          <p className="font-medium">{formatDate(order.ocDate)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 mb-1">Fecha Entrega</p>
          <p className={`font-medium ${order.expectedDeliveryDate && new Date(order.expectedDeliveryDate) < new Date() && order.status !== 'ENTREGADA' ? 'text-red-600' : ''}`}>
            {formatDate(order.expectedDeliveryDate)}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 mb-1">Total</p>
          <p className="font-bold text-blue-700">{formatCurrency(order.totalFinal)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Progreso de entrega</span>
          <span className="text-gray-500">{totalDelivered} / {totalQty} unidades ({progress}%)</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-700 text-sm">Productos</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Código</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Producto</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Total</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Entregado</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Pendiente</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Precio U.</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items?.map((item: any) => (
              <tr key={item.id} className={item.pendingQty === 0 ? 'bg-green-50' : ''}>
                <td className="px-4 py-2 text-xs text-gray-400">{item.productCode || '-'}</td>
                <td className="px-4 py-2 font-medium">{item.productName}</td>
                <td className="px-4 py-2 text-right">{item.quantity} {item.unit}</td>
                <td className="px-4 py-2 text-right text-green-600">{item.deliveredQty}</td>
                <td className="px-4 py-2 text-right">
                  <span className={item.pendingQty > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                    {item.pendingQty}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Delivery Form */}
      {showDeliveryForm && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Programar Entrega</h2>
            <button onClick={() => setShowDeliveryForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Programada</label>
              <input
                type="date"
                value={delivery.scheduledDate}
                onChange={e => setDelivery(d => ({ ...d, scheduledDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transportista</label>
              <input
                type="text"
                value={delivery.transportist}
                onChange={e => setDelivery(d => ({ ...d, transportist: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ruta</label>
              <input
                type="text"
                value={delivery.route}
                onChange={e => setDelivery(d => ({ ...d, route: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
              <input
                type="text"
                value={delivery.notes}
                onChange={e => setDelivery(d => ({ ...d, notes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Cantidades a entregar</p>
            <div className="space-y-2">
              {delivery.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-gray-700">{item.productName}</span>
                  <span className="text-xs text-gray-400">máx: {item.max}</span>
                  <input
                    type="number"
                    min="0"
                    max={item.max}
                    value={item.quantity}
                    onChange={e => {
                      const items = [...delivery.items]
                      items[i] = { ...items[i], quantity: parseFloat(e.target.value) || 0 }
                      setDelivery(d => ({ ...d, items }))
                    }}
                    className="w-24 px-2 py-1 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createDelivery}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {updating ? 'Guardando...' : 'Programar Entrega'}
            </button>
          </div>
        </div>
      )}

      {/* Deliveries */}
      {order.deliveries?.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-700 text-sm">Entregas ({order.deliveries.length})</h2>
          </div>
          <div className="divide-y">
            {order.deliveries.map((d: any) => (
              <div key={d.id}>
                {/* Delivery header row */}
                <div className="px-4 py-3 flex items-center gap-3 text-sm">
                  <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                    d.status === 'ENTREGADA' ? 'bg-green-100 text-green-700' :
                    d.status === 'EN_RUTA' ? 'bg-sky-100 text-sky-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {d.deliveryNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">Entrega #{d.deliveryNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.status === 'ENTREGADA' ? 'bg-green-100 text-green-700' :
                        d.status === 'EN_RUTA' ? 'bg-sky-100 text-sky-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{d.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {d.scheduledDate && `Programada: ${formatDate(d.scheduledDate)}`}
                      {d.deliveredDate && ` · Entregada: ${formatDate(d.deliveredDate)}`}
                      {d.transportist && ` · ${d.transportist}`}
                      {d.route && ` · Ruta: ${d.route}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Action buttons */}
                    {d.status === 'PROGRAMADA' && (
                      <button
                        onClick={() => markEnRoute(d.id)}
                        disabled={updating}
                        className="flex items-center gap-1 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Truck className="h-3.5 w-3.5" /> En Ruta
                      </button>
                    )}
                    {(d.status === 'PROGRAMADA' || d.status === 'EN_RUTA') && (
                      <button
                        onClick={() => confirmingDelivery === d.id ? setConfirmingDelivery(null) : startConfirm(d)}
                        disabled={updating}
                        className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <PackageCheck className="h-3.5 w-3.5" /> Confirmar
                      </button>
                    )}
                    {/* Toggle items */}
                    <button
                      onClick={() => setExpandedDelivery(expandedDelivery === d.id ? null : d.id)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      {expandedDelivery === d.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded items list */}
                {expandedDelivery === d.id && (
                  <div className="border-t bg-gray-50 px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="text-left pb-1.5 font-medium">Producto</th>
                          <th className="text-right pb-1.5 font-medium w-24">Programado</th>
                          <th className="text-right pb-1.5 font-medium w-24">Entregado</th>
                          <th className="text-right pb-1.5 font-medium w-24">Faltante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {d.items?.map((item: any) => {
                          const orderItem = order.items?.find((oi: any) => oi.id === item.orderItemId)
                          return (
                            <tr key={item.id} className="text-gray-700">
                              <td className="py-1.5">{orderItem?.productName || '—'}</td>
                              <td className="py-1.5 text-right">{item.quantity}</td>
                              <td className={`py-1.5 text-right font-medium ${item.delivered > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {d.status === 'ENTREGADA' ? item.delivered : '—'}
                              </td>
                              <td className={`py-1.5 text-right font-medium ${item.missing > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {d.status === 'ENTREGADA' ? item.missing : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {d.notes && <p className="text-xs text-gray-500 mt-2">Nota: {d.notes}</p>}
                  </div>
                )}

                {/* Confirm delivery form */}
                {confirmingDelivery === d.id && (
                  <div className="border-t bg-blue-50 px-4 py-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-800">Confirmar Entrega #{d.deliveryNumber}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-blue-200">
                          <th className="text-left pb-1.5 font-medium">Producto</th>
                          <th className="text-right pb-1.5 font-medium w-24">Programado</th>
                          <th className="text-right pb-1.5 font-medium w-28">Entregado</th>
                          <th className="text-right pb-1.5 font-medium w-28">Faltante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100">
                        {confirmItems.map((item, i) => (
                          <tr key={item.deliveryItemId}>
                            <td className="py-1.5 text-gray-700">{item.productName}</td>
                            <td className="py-1.5 text-right text-gray-500">{item.quantity}</td>
                            <td className="py-1.5 text-right">
                              <input
                                type="number" min="0" max={item.quantity}
                                value={item.delivered}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0
                                  const next = [...confirmItems]
                                  next[i] = { ...next[i], delivered: val, missing: Math.max(0, item.quantity - val) }
                                  setConfirmItems(next)
                                }}
                                className="w-20 px-2 py-0.5 border rounded text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-1.5 text-right">
                              <input
                                type="number" min="0" max={item.quantity}
                                value={item.missing}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0
                                  const next = [...confirmItems]
                                  next[i] = { ...next[i], missing: val }
                                  setConfirmItems(next)
                                }}
                                className="w-20 px-2 py-0.5 border rounded text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => confirmDelivery(d.id)}
                        disabled={updating}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        {updating ? 'Guardando...' : 'Confirmar Entrega'}
                      </button>
                      <button
                        onClick={() => setConfirmingDelivery(null)}
                        className="text-xs px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Addresses & Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 mb-1">Dirección Despacho</p>
          <p className="text-sm">{order.deliveryAddress}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 mb-1">Dirección Facturación</p>
          <p className="text-sm">{order.billingAddress || '-'}</p>
        </div>
      </div>

      {/* Activity Log */}
      {order.logs?.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-700 text-sm mb-4">Historial</h2>
          <div className="space-y-3">
            {order.logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                <div>
                  <p className="font-medium text-gray-700">{log.action.replace(/_/g, ' ')}</p>
                  {log.comment && <p className="text-xs text-gray-500">{log.comment}</p>}
                  <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('es-CL')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
