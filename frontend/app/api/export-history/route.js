import { NextResponse } from 'next/server'
import { exportHistory } from '@/lib/database'

export async function GET() {
  try {
    const exports = await exportHistory.getAll()
    
    // Parsuj article_ids z JSON string na array
    const exportsWithParsedIds = exports.map(exp => ({
      ...exp,
      article_ids: JSON.parse(exp.article_ids || '[]')
    }))
    
    return NextResponse.json({
      success: true,
      exports: exportsWithParsedIds
    })
  } catch (error) {
    console.error('Błąd pobierania historii eksportów:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

