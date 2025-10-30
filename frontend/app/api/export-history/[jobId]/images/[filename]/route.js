import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { exportHistory } from '@/lib/database'

export async function GET(request, { params }) {
  try {
    const { jobId, filename } = params
    
    // Sprawdź czy eksport istnieje
    const exportRecord = await exportHistory.getByJobId(jobId)
    if (!exportRecord) {
      return new NextResponse('Eksport nie znaleziony', { status: 404 })
    }
    
    // Zabezpieczenie przed path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Nieprawidłowa nazwa pliku', { status: 400 })
    }
    
    // Odczytaj plik obrazka
    const imagePath = path.join(process.cwd(), 'tmp', 'ftp-export', jobId, filename)
    
    try {
      const imageBuffer = await fs.readFile(imagePath)
      
      // Określ MIME type na podstawie rozszerzenia
      const ext = path.extname(filename).toLowerCase()
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    } catch (fileError) {
      return new NextResponse('Plik nie znaleziony', { status: 404 })
    }
  } catch (error) {
    console.error('Błąd odczytu obrazka:', error)
    return new NextResponse('Błąd serwera', { status: 500 })
  }
}

