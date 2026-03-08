'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Truck,
  Package,
  PlusCircle,
  ClipboardList,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Órdenes de Compra', icon: FileText },
  { href: '/orders/new', label: 'Nueva OC', icon: PlusCircle },
  { href: '/dispatch', label: 'Despacho', icon: Truck },
  { href: '/warehouse', label: 'Bodega', icon: Package },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-blue-400" />
          <div>
            <p className="font-bold text-sm leading-tight">Sistema OC</p>
            <p className="text-xs text-slate-400">Control de Pedidos</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">v1.0.0 MVP</p>
      </div>
    </aside>
  )
}
