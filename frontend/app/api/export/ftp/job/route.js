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

    const localRoot = path.join(process.cwd(), 'tmp', 'ftp-export', jobId)
    const entries = await fs.readdir(localRoot, { withFileTypes: true })
    const files = []
    for (const ent of entries) {
      if (!ent.isFile()) continue
      const fpath = path.join(localRoot, ent.name)
      const stat = await fs.stat(fpath)
      files.push({ name: ent.name, size: stat.size })
    }
    return NextResponse.json({ success: true, jobId, files })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd odczytu joba' }, { status: 500 })
  }
}


