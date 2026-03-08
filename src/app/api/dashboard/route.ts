import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { STATUS_LABELS } from '@/lib/utils'

export async function GET() {
  try {
    const now = new Date()

    const [total, byStatus, vencidos, recentLogs] = await Promise.all([
      prisma.order.count(),
      prisma.order.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.order.count({
        where: {
          expectedDeliveryDate: { lt: now },
          status: { notIn: ['ENTREGADA', 'CERRADA'] }
        }
      }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { ocNumber: true, buyerName: true } } },
      }),
    ])

    const statusMap = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count.status
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      total,
      pendientes: (statusMap['INGRESADA'] || 0) + (statusMap['VALIDADA'] || 0) + (statusMap['PENDIENTE_CALENDARIZAR'] || 0),
      enRuta: statusMap['EN_RUTA'] || 0,
      entregados: statusMap['ENTREGADA'] || 0,
      pendienteStock: statusMap['PENDIENTE_STOCK'] || 0,
      vencidos,
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.status,
        label: STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] || s.status,
      })),
      recentLogs,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
