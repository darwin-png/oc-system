import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; deliveryId: string } }
) {
  try {
    const body = await req.json()
    const { status, deliveredDate, items } = body

    const delivery = await prisma.delivery.findUnique({
      where: { id: params.deliveryId },
      include: { items: true },
    })
    if (!delivery) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })

    if (status === 'EN_RUTA') {
      const updated = await prisma.delivery.update({
        where: { id: params.deliveryId },
        data: { status: 'EN_RUTA' },
        include: { items: true },
      })
      await prisma.activityLog.create({
        data: {
          orderId: params.id,
          deliveryId: params.deliveryId,
          action: 'ENTREGA_EN_RUTA',
          comment: `Entrega ${delivery.deliveryNumber} salió a ruta`,
        },
      })
      return NextResponse.json(updated)
    }

    if (status === 'ENTREGADA') {
      // Update each DeliveryItem with actual delivered/missing quantities
      if (items?.length) {
        await Promise.all(
          items.map((item: { deliveryItemId: string; delivered: number; missing: number }) =>
            prisma.deliveryItem.update({
              where: { id: item.deliveryItemId },
              data: { delivered: item.delivered, missing: item.missing },
            })
          )
        )

        // Update OrderItem deliveredQty and pendingQty for each item
        for (const item of items) {
          const deliveryItem = delivery.items.find(i => i.id === item.deliveryItemId)
          if (!deliveryItem) continue
          await prisma.orderItem.update({
            where: { id: deliveryItem.orderItemId },
            data: {
              deliveredQty: { increment: item.delivered },
              pendingQty: { decrement: item.delivered },
            },
          })
        }
      }

      // Mark delivery as ENTREGADA
      const updated = await prisma.delivery.update({
        where: { id: params.deliveryId },
        data: {
          status: 'ENTREGADA',
          deliveredDate: deliveredDate ? new Date(deliveredDate) : new Date(),
        },
        include: { items: true },
      })

      // Check if all order items are fully delivered
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: params.id },
      })
      const allDelivered = orderItems.every(i => i.pendingQty <= 0)
      const newOrderStatus = allDelivered ? 'ENTREGADA' : 'PARCIALMENTE_ENTREGADA'

      await prisma.order.update({
        where: { id: params.id },
        data: { status: newOrderStatus },
      })

      const totalDelivered = items?.reduce((s: number, i: any) => s + i.delivered, 0) ?? 0
      const totalMissing = items?.reduce((s: number, i: any) => s + i.missing, 0) ?? 0

      await prisma.activityLog.create({
        data: {
          orderId: params.id,
          deliveryId: params.deliveryId,
          action: 'ENTREGA_CONFIRMADA',
          comment: `Entrega ${delivery.deliveryNumber} confirmada. Entregado: ${totalDelivered}, Faltante: ${totalMissing}`,
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar entrega' }, { status: 500 })
  }
}
