import { Order, OrderItem, Delivery, DeliveryItem, User, ActivityLog } from '@prisma/client'

export type OrderStatus =
  | 'INGRESADA' | 'VALIDADA' | 'PENDIENTE_CALENDARIZAR' | 'PARCIALMENTE_CALENDARIZADA'
  | 'CALENDARIZADA' | 'EN_PREPARACION' | 'PARCIALMENTE_PREPARADA' | 'PREPARADA'
  | 'EN_RUTA' | 'PARCIALMENTE_ENTREGADA' | 'ENTREGADA' | 'PENDIENTE_STOCK' | 'CERRADA'

export type Department = 'COMERCIAL' | 'DESPACHO' | 'BODEGA' | 'ADMINISTRACION'

export type OrderWithItems = Order & {
  items: OrderItem[]
  deliveries: (Delivery & { items: DeliveryItem[] })[]
  createdBy?: User | null
  logs?: ActivityLog[]
}

export type DashboardStats = {
  total: number
  pendientes: number
  enRuta: number
  entregados: number
  pendienteStock: number
  vencidos: number
  byStatus: { status: OrderStatus; count: number; label: string }[]
}
