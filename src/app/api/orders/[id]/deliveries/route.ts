import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { scheduledDate, transportist, route, notes, items } = body

    // Count existing deliveries
    const existingCount = await prisma.delivery.count({ where: { orderId: params.id } })

    // Validate quantities don't exceed pending
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    // Check each item quantity
    for (const deliveryItem of items) {
      const orderItem = order.items.find(i => i.id === deliveryItem.orderItemId)
      if (!orderItem) continue
      if (deliveryItem.quantity > orderItem.pendingQty) {
        return NextResponse.json({
          error: `Cantidad excede pendiente para ${orderItem.productName}: máx ${orderItem.pendingQty}`
        }, { status: 400 })
      }
    }

    const delivery = await prisma.delivery.create({
      data: {
        orderId: params.id,
        deliveryNumber: existingCount + 1,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        transportist,
        route,
        notes,
        status: 'PROGRAMADA',
        items: {
          create: items.map((item: any) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // Update order status
    await prisma.order.update({
      where: { id: params.id },
      data: { status: existingCount > 0 ? 'PARCIALMENTE_CALENDARIZADA' : 'CALENDARIZADA' },
    })

    await prisma.activityLog.create({
      data: {
        orderId: params.id,
        deliveryId: delivery.id,
        action: 'ENTREGA_PROGRAMADA',
        comment: `Entrega ${delivery.deliveryNumber} programada para ${scheduledDate || 'fecha por definir'}`,
      },
    })

    return NextResponse.json(delivery, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear entrega' }, { status: 500 })
  }
}
