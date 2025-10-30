import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { exportHistory } from '@/lib/database'

export async function GET(request, { params }) {
  try {
    const { jobId } = params
    
    // Sprawdź czy eksport istnieje
    const exportRecord = await exportHistory.getByJobId(jobId)
    if (!exportRecord) {
      return NextResponse.json(
        { success: false, error: 'Eksport nie znaleziony' },
        { status: 404 }
      )
    }
    
    // Odczytaj listę plików z folderu eksportu
    const exportDir = path.join(process.cwd(), 'tmp', 'ftp-export', jobId)
    
    try {
      const files = await fs.readdir(exportDir)
      
      // Filtruj tylko obrazki (jpg, jpeg, png, webp, gif)
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
      )
      
      // Pobierz rozmiary plików
      const images = await Promise.all(
        imageFiles.map(async (filename) => {
          const filePath = path.join(exportDir, filename)
          const stats = await fs.stat(filePath)
          return {
            filename,
            size: stats.size
          }
        })
      )
      
      return NextResponse.json({
        success: true,
        images
      })
    } catch (fileError) {
      return NextResponse.json(
        { success: false, error: 'Folder eksportu nie został znaleziony (prawdopodobnie usunięty)' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Błąd pobierania listy obrazków:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

