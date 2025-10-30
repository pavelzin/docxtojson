import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { exportHistory } from '@/lib/database'

export async function GET(request, { params }) {
  try {
    const { jobId } = params
    
    // Sprawdź czy eksport istnieje w bazie
    const exportRecord = await exportHistory.getByJobId(jobId)
    if (!exportRecord) {
      return NextResponse.json(
        { success: false, error: 'Eksport nie znaleziony' },
        { status: 404 }
      )
    }
    
    // Odczytaj plik JSON
    const jsonPath = path.join(process.cwd(), 'tmp', 'ftp-export', jobId, exportRecord.json_filename)
    
    try {
      const jsonContent = await fs.readFile(jsonPath, 'utf-8')
      const content = JSON.parse(jsonContent)
      
      return NextResponse.json({
        success: true,
        content,
        filename: exportRecord.json_filename
      })
    } catch (fileError) {
      return NextResponse.json(
        { success: false, error: 'Plik JSON nie został znaleziony (prawdopodobnie usunięty)' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Błąd odczytu JSON:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

