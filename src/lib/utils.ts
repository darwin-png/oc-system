import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { OrderStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount)
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  INGRESADA: 'Ingresada',
  VALIDADA: 'Validada',
  PENDIENTE_CALENDARIZAR: 'Pend. Calendarizar',
  PARCIALMENTE_CALENDARIZADA: 'Parc. Calendarizada',
  CALENDARIZADA: 'Calendarizada',
  EN_PREPARACION: 'En Preparación',
  PARCIALMENTE_PREPARADA: 'Parc. Preparada',
  PREPARADA: 'Preparada',
  EN_RUTA: 'En Ruta',
  PARCIALMENTE_ENTREGADA: 'Parc. Entregada',
  ENTREGADA: 'Entregada',
  PENDIENTE_STOCK: 'Pend. Stock',
  CERRADA: 'Cerrada',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  INGRESADA: 'bg-gray-100 text-gray-800',
  VALIDADA: 'bg-blue-100 text-blue-800',
  PENDIENTE_CALENDARIZAR: 'bg-yellow-100 text-yellow-800',
  PARCIALMENTE_CALENDARIZADA: 'bg-orange-100 text-orange-800',
  CALENDARIZADA: 'bg-cyan-100 text-cyan-800',
  EN_PREPARACION: 'bg-purple-100 text-purple-800',
  PARCIALMENTE_PREPARADA: 'bg-indigo-100 text-indigo-800',
  PREPARADA: 'bg-teal-100 text-teal-800',
  EN_RUTA: 'bg-sky-100 text-sky-800',
  PARCIALMENTE_ENTREGADA: 'bg-amber-100 text-amber-800',
  ENTREGADA: 'bg-green-100 text-green-800',
  PENDIENTE_STOCK: 'bg-red-100 text-red-800',
  CERRADA: 'bg-slate-100 text-slate-800',
}

export const STATUS_DOT: Record<OrderStatus, string> = {
  INGRESADA: 'bg-gray-400',
  VALIDADA: 'bg-blue-500',
  PENDIENTE_CALENDARIZAR: 'bg-yellow-500',
  PARCIALMENTE_CALENDARIZADA: 'bg-orange-500',
  CALENDARIZADA: 'bg-cyan-500',
  EN_PREPARACION: 'bg-purple-500',
  PARCIALMENTE_PREPARADA: 'bg-indigo-500',
  PREPARADA: 'bg-teal-500',
  EN_RUTA: 'bg-sky-500',
  PARCIALMENTE_ENTREGADA: 'bg-amber-500',
  ENTREGADA: 'bg-green-500',
  PENDIENTE_STOCK: 'bg-red-500',
  CERRADA: 'bg-slate-500',
}
