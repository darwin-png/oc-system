'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { BarChart3, Clock, AlertTriangle, Truck, Package, CheckCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  total: number
  pendientes: number
  enRuta: number
  entregados: number
  pendienteStock: number
  vencidos: number
  byStatus: { status: string; count: number; label: string }[]
  recentLogs: any[]
}

const STATUS_BG: Record<string, string> = {
  INGRESADA: 'bg-gray-200',
  VALIDADA: 'bg-blue-300',
  PENDIENTE_CALENDARIZAR: 'bg-yellow-300',
  PARCIALMENTE_CALENDARIZADA: 'bg-orange-300',
  CALENDARIZADA: 'bg-cyan-300',
  EN_PREPARACION: 'bg-purple-300',
  PARCIALMENTE_PREPARADA: 'bg-indigo-300',
  PREPARADA: 'bg-teal-300',
  EN_RUTA: 'bg-sky-400',
  PARCIALMENTE_ENTREGADA: 'bg-amber-300',
  ENTREGADA: 'bg-green-400',
  PENDIENTE_STOCK: 'bg-red-400',
  CERRADA: 'bg-slate-300',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  if (!stats) return <div className="p-6 text-red-600">Error cargando datos</div>

  const topStats = [
    { label: 'Total OC', value: stats.total, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50', href: '/orders' },
    { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', href: '/orders?status=VALIDADA' },
    { label: 'En Ruta', value: stats.enRuta, icon: Truck, color: 'text-sky-600', bg: 'bg-sky-50', href: '/dispatch' },
    { label: 'Entregadas', value: stats.entregados, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', href: '/orders?status=ENTREGADA' },
    { label: 'Sin Stock', value: stats.pendienteStock, icon: Package, color: 'text-red-600', bg: 'bg-red-50', href: '/orders?status=PENDIENTE_STOCK' },
    { label: 'Vencidas', value: stats.vencidos, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', href: '/orders' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Control</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vista ejecutiva del estado de pedidos</p>
        </div>
        <Link href="/orders/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nueva OC
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {topStats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href} className={`${bg} rounded-xl p-4 hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Distribución por Estado
        </h2>
        <div className="space-y-2">
          {stats.byStatus.sort((a, b) => b.count - a.count).map(({ status, count, label }) => {
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
            return (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-40 truncate">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${STATUS_BG[status] || 'bg-gray-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Actividad Reciente</h2>
        {stats.recentLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin actividad reciente</p>
        ) : (
          <div className="space-y-3">
            {stats.recentLogs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-gray-800">
                    <span className="font-medium">{log.order?.ocNumber || 'Sistema'}</span>
                    {' · '}
                    <span className="text-gray-600">{log.action.replace(/_/g, ' ')}</span>
                  </p>
                  {log.comment && <p className="text-xs text-gray-400">{log.comment}</p>}
                  <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('es-CL')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
