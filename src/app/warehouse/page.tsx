'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function WarehousePage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/orders?status=CALENDARIZADA').then(r => r.json()),
      fetch('/api/orders?status=EN_PREPARACION').then(r => r.json()),
      fetch('/api/orders?status=PARCIALMENTE_PREPARADA').then(r => r.json()),
      fetch('/api/orders?status=PENDIENTE_STOCK').then(r => r.json()),
    ]).then(results => {
      setOrders(results.flat().filter(Boolean))
      setLoading(false)
    })
  }, [])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = orders.map(o => o.id === id ? { ...o, status } : o)
    setOrders(updated)
  }

  const grupos = {
    'Pendiente Preparar': orders.filter(o => o.status === 'CALENDARIZADA'),
    'En Preparación': orders.filter(o => o.status === 'EN_PREPARACION'),
    'Sin Stock': orders.filter(o => o.status === 'PENDIENTE_STOCK'),
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bodega</h1>
          <p className="text-sm text-gray-500">Preparación y control de pedidos</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {Object.entries(grupos).map(([label, items]) => (
          <div key={label} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-gray-700">{label}</h2>
              <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">Sin pedidos</div>
            ) : items.map((order: any) => (
              <div key={order.id} className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono font-medium text-blue-700 text-sm">{order.ocNumber}</p>
                    <p className="text-xs text-gray-500 truncate">{order.buyerName}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <p>Entrega: {formatDate(order.expectedDeliveryDate)}</p>
                  <p>Total: {formatCurrency(order.totalFinal)}</p>
                  <p>Productos: {order.items?.length || 0}</p>
                </div>
                <div className="flex gap-2">
                  {order.status === 'CALENDARIZADA' && (
                    <button
                      onClick={() => updateStatus(order.id, 'EN_PREPARACION')}
                      className="flex-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Iniciar Preparación
                    </button>
                  )}
                  {order.status === 'EN_PREPARACION' && (
                    <button
                      onClick={() => updateStatus(order.id, 'PREPARADA')}
                      className="flex-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Marcar Lista
                    </button>
                  )}
                  {order.status === 'PENDIENTE_STOCK' && (
                    <button
                      onClick={() => updateStatus(order.id, 'EN_PREPARACION')}
                      className="flex-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Stock Disponible
                    </button>
                  )}
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded-lg transition-colors"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
