import { NextRequest, NextResponse } from 'next/server'
import { parsePDFText } from '@/lib/pdf-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('pdf') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    let text = ''
    try {
      // Dynamic import to avoid SSR issues
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      text = data.text
    } catch (parseError) {
      console.error('PDF parse error:', parseError)
      return NextResponse.json({ error: 'No se pudo leer el PDF' }, { status: 400 })
    }

    const parsed = parsePDFText(text)
    return NextResponse.json({ parsed, rawText: text.slice(0, 2000) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al procesar PDF' }, { status: 500 })
  }
}
