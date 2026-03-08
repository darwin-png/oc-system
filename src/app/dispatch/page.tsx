'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { MapPin, Calendar, AlertTriangle } from 'lucide-react'

export default function DispatchPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/orders?status=PREPARADA').then(r => r.json()),
      fetch('/api/orders?status=EN_RUTA').then(r => r.json()),
      fetch('/api/orders?status=PARCIALMENTE_ENTREGADA').then(r => r.json()),
    ]).then(results => {
      setOrders(results.flat())
      setLoading(false)
    })
  }, [])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  const grupos = {
    'Listas para Despacho': orders.filter(o => o.status === 'PREPARADA'),
    'En Ruta': orders.filter(o => o.status === 'EN_RUTA'),
    'Entrega Parcial': orders.filter(o => o.status === 'PARCIALMENTE_ENTREGADA'),
  }

  const today = new Date()

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Despacho</h1>
        <p className="text-sm text-gray-500">Control de rutas y entregas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(grupos).map(([label, items]) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-3 gap-5">
        {Object.entries(grupos).map(([label, items]) => (
          <div key={label} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-gray-700">{label}</h2>
              <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">Sin pedidos</div>
            ) : items.map((order: any) => {
              const isOverdue = order.expectedDeliveryDate && new Date(order.expectedDeliveryDate) < today
              return (
                <div key={order.id} className={`bg-white rounded-xl border p-4 space-y-3 ${isOverdue ? 'border-red-200' : ''}`}>
                  {isOverdue && (
                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Vencida</span>
                    </div>
                  )}
                  <div>
                    <p className="font-mono font-medium text-blue-700 text-sm">{order.ocNumber}</p>
                    <p className="text-xs text-gray-500 truncate">{order.buyerName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{order.deliveryAddress}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(order.expectedDeliveryDate)}</span>
                    </div>
                    <p>{formatCurrency(order.totalFinal)}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'PREPARADA' && (
                      <button
                        onClick={() => updateStatus(order.id, 'EN_RUTA')}
                        className="flex-1 text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-medium py-1.5 rounded-lg"
                      >
                        Salir a Ruta
                      </button>
                    )}
                    {order.status === 'EN_RUTA' && (
                      <button
                        onClick={() => updateStatus(order.id, 'ENTREGADA')}
                        className="flex-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 font-medium py-1.5 rounded-lg"
                      >
                        Confirmar Entrega
                      </button>
                    )}
                    {order.status === 'PARCIALMENTE_ENTREGADA' && (
                      <button
                        onClick={() => updateStatus(order.id, 'EN_RUTA')}
                        className="flex-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium py-1.5 rounded-lg"
                      >
                        Nueva Salida
                      </button>
                    )}
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded-lg"
                    >
                      Ver
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
