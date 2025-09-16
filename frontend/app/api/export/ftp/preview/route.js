import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Brak jobId' }, { status: 400 })
    }

    const localJsonPath = path.join(process.cwd(), 'tmp', 'ftp-export', jobId, 'articles.json')
    
    try {
      const jsonContent = await fs.readFile(localJsonPath, 'utf-8')
      return NextResponse.json({ success: true, json: jsonContent })
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono pliku JSON' }, { status: 404 })
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
