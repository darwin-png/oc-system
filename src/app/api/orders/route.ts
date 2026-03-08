import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as OrderStatus | null
    const search = searchParams.get('search')

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { ocNumber: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
        { buyerRut: { contains: search, mode: 'insensitive' } },
      ]
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        deliveries: { include: { items: true } },
        createdBy: { select: { name: true, department: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, ...orderData } = body

    const order = await prisma.order.create({
      data: {
        ...orderData,
        ocDate: new Date(orderData.ocDate),
        sentDate: orderData.sentDate ? new Date(orderData.sentDate) : null,
        acceptanceDate: orderData.acceptanceDate ? new Date(orderData.acceptanceDate) : null,
        expectedDeliveryDate: orderData.expectedDeliveryDate ? new Date(orderData.expectedDeliveryDate) : null,
        items: {
          create: items.map((item: any) => ({
            ...item,
            pendingQty: item.quantity,
            deliveredQty: 0,
          })),
        },
      },
      include: { items: true },
    })

    await prisma.activityLog.create({
      data: {
        orderId: order.id,
        action: 'ORDEN_INGRESADA',
        comment: `OC ${order.ocNumber} ingresada al sistema`,
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error(error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una OC con ese número' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 })
  }
}
