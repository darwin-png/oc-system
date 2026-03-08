'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import { OrderStatus } from '@/types'
import { Search, PlusCircle, Eye, FileText } from 'lucide-react'

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'INGRESADA', label: 'Ingresadas' },
  { value: 'VALIDADA', label: 'Validadas' },
  { value: 'CALENDARIZADA', label: 'Calendarizadas' },
  { value: 'EN_PREPARACION', label: 'En Preparación' },
  { value: 'EN_RUTA', label: 'En Ruta' },
  { value: 'PARCIALMENTE_ENTREGADA', label: 'Parc. Entregada' },
  { value: 'PENDIENTE_STOCK', label: 'Sin Stock' },
  { value: 'ENTREGADA', label: 'Entregadas' },
]

function OrdersContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const activeStatus = searchParams.get('status') || ''

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeStatus) params.set('status', activeStatus)
    if (search) params.set('search', search)
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [activeStatus, search])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOrders()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de Compra</h1>
        <Link href="/orders/new" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <PlusCircle className="h-4 w-4" />
          Nueva OC
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => router.push(value ? `/orders?status=${value}` : '/orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeStatus === value
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número OC, organismo, RUT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition-colors">
          Buscar
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <FileText className="h-8 w-8 mb-2" />
            <p className="text-sm">No hay órdenes de compra</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">N° OC</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Organismo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha OC</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">F. Entrega</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ítems</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order: any) => {
                const isOverdue = order.expectedDeliveryDate &&
                  new Date(order.expectedDeliveryDate) < new Date() &&
                  !['ENTREGADA', 'CERRADA'].includes(order.status)
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-blue-700">{order.ocNumber}</span>
                        {order.requiresValidation && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">validar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-48">{order.buyerName}</p>
                      <p className="text-xs text-gray-400">{order.buyerRut}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(order.ocDate)}</td>
                    <td className="px-4 py-3">
                      <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {formatDate(order.expectedDeliveryDate)}
                        {isOverdue && ' ⚠'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(order.totalFinal)}</td>
                    <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{order.items?.length || 0}</td>
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <OrdersContent />
    </Suspense>
  )
}
