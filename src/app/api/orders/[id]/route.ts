import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        deliveries: { include: { items: true }, orderBy: { deliveryNumber: 'asc' } },
        createdBy: { select: { name: true, department: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })
    if (!order) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { status, action, comment, ...updateData } = body

    const current = await prisma.order.findUnique({ where: { id: params.id } })
    if (!current) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        ...updateData,
        ...(status && { status }),
        ...(updateData.expectedDeliveryDate && { expectedDeliveryDate: new Date(updateData.expectedDeliveryDate) }),
        ...(updateData.ocDate && { ocDate: new Date(updateData.ocDate) }),
      },
      include: { items: true, deliveries: { include: { items: true } } },
    })

    if (status || action) {
      await prisma.activityLog.create({
        data: {
          orderId: params.id,
          action: action || `STATUS_CHANGED_TO_${status}`,
          comment: comment || `Estado actualizado a ${status}`,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}
