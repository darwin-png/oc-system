import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'comercial@empresa.cl' },
      update: {},
      create: { name: 'María González', email: 'comercial@empresa.cl', department: 'COMERCIAL' }
    }),
    prisma.user.upsert({
      where: { email: 'despacho@empresa.cl' },
      update: {},
      create: { name: 'Carlos Pérez', email: 'despacho@empresa.cl', department: 'DESPACHO' }
    }),
    prisma.user.upsert({
      where: { email: 'bodega@empresa.cl' },
      update: {},
      create: { name: 'Juan Rodríguez', email: 'bodega@empresa.cl', department: 'BODEGA' }
    }),
  ])

  // Create sample orders
  const order1 = await prisma.order.create({
    data: {
      ocNumber: 'OC-2024-001234',
      ocDate: new Date('2024-02-15'),
      buyerName: 'Municipalidad de Santiago',
      buyerRut: '69.070.396-0',
      deliveryAddress: 'Av. Libertador Bernardo O\'Higgins 1353, Santiago',
      billingAddress: 'Av. Libertador Bernardo O\'Higgins 1353, Santiago',
      totalNet: 2500000,
      iva: 475000,
      totalFinal: 2975000,
      status: 'VALIDADA',
      expectedDeliveryDate: new Date('2024-03-01'),
      createdById: users[0].id,
      items: {
        create: [
          { productCode: 'PROD-001', productName: 'Silla Ergonómica Ejecutiva', quantity: 50, unitPrice: 25000, totalPrice: 1250000, unit: 'UN', pendingQty: 50 },
          { productCode: 'PROD-002', productName: 'Escritorio Modular 160cm', quantity: 25, unitPrice: 50000, totalPrice: 1250000, unit: 'UN', pendingQty: 25 },
        ]
      }
    }
  })

  const order2 = await prisma.order.create({
    data: {
      ocNumber: 'OC-2024-001235',
      ocDate: new Date('2024-02-18'),
      buyerName: 'Hospital San José',
      buyerRut: '61.816.000-2',
      deliveryAddress: 'Av. Independencia 1027, Santiago',
      billingAddress: 'Av. Independencia 1027, Santiago',
      totalNet: 1800000,
      iva: 342000,
      totalFinal: 2142000,
      status: 'PARCIALMENTE_ENTREGADA',
      expectedDeliveryDate: new Date('2024-02-25'),
      createdById: users[0].id,
      items: {
        create: [
          { productCode: 'PROD-003', productName: 'Mascarillas Quirúrgicas', quantity: 1000, unitPrice: 800, totalPrice: 800000, unit: 'UN', deliveredQty: 400, pendingQty: 600 },
          { productCode: 'PROD-004', productName: 'Guantes de Nitrilo M', quantity: 500, unitPrice: 2000, totalPrice: 1000000, unit: 'UN', deliveredQty: 300, pendingQty: 200 },
        ]
      }
    }
  })

  const order3 = await prisma.order.create({
    data: {
      ocNumber: 'OC-2024-001236',
      ocDate: new Date('2024-02-20'),
      buyerName: 'Ministerio de Educación',
      buyerRut: '61.979.440-6',
      deliveryAddress: 'Av. Libertador Bernardo O\'Higgins 1371, Santiago',
      billingAddress: 'Av. Libertador Bernardo O\'Higgins 1371, Santiago',
      totalNet: 3200000,
      iva: 608000,
      totalFinal: 3808000,
      status: 'PENDIENTE_STOCK',
      expectedDeliveryDate: new Date('2024-02-22'),
      observations: 'Entrega urgente requerida',
      createdById: users[0].id,
      items: {
        create: [
          { productCode: 'PROD-005', productName: 'Notebook HP 15"', quantity: 40, unitPrice: 80000, totalPrice: 3200000, unit: 'UN', pendingQty: 40 },
        ]
      }
    }
  })

  const order4 = await prisma.order.create({
    data: {
      ocNumber: 'OC-2024-001237',
      ocDate: new Date('2024-02-22'),
      buyerName: 'Servicio de Salud Metropolitano',
      buyerRut: '61.604.302-9',
      deliveryAddress: 'Calle Huérfanos 1400, Santiago',
      billingAddress: 'Calle Huérfanos 1400, Santiago',
      totalNet: 950000,
      iva: 180500,
      totalFinal: 1130500,
      status: 'EN_RUTA',
      expectedDeliveryDate: new Date('2024-02-28'),
      createdById: users[0].id,
      items: {
        create: [
          { productCode: 'PROD-006', productName: 'Impresora Láser A4', quantity: 5, unitPrice: 190000, totalPrice: 950000, unit: 'UN', pendingQty: 5 },
        ]
      }
    }
  })

  // Create logs
  await prisma.activityLog.createMany({
    data: [
      { orderId: order1.id, userId: users[0].id, department: 'COMERCIAL', action: 'ORDEN_INGRESADA', comment: 'OC recibida y registrada' },
      { orderId: order1.id, userId: users[0].id, department: 'COMERCIAL', action: 'ORDEN_VALIDADA', comment: 'OC validada por comercial' },
      { orderId: order2.id, userId: users[1].id, department: 'DESPACHO', action: 'ENTREGA_PARCIAL', comment: 'Primera entrega: 400 mascarillas y 300 guantes' },
      { orderId: order3.id, userId: users[2].id, department: 'BODEGA', action: 'FALTANTE_REGISTRADO', comment: 'Sin stock de Notebook HP 15"' },
    ]
  })

  console.log('✅ Seed completado')
}

main().catch(console.error).finally(() => prisma.$disconnect())
