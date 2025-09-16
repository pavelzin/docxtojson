import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { uploadToFtp } from '@/lib/ftp'

// TEMP: Bypass auth for testing
const BYPASS_AUTH = true

export async function POST(request) {
  try {
    console.log('🚀 FTP SHIP - Starting...')
    const { jobId, ftpConfig } = await request.json()
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Brak jobId' }, { status: 400 })
    }
    console.log(`📦 Processing job: ${jobId}`)

    // Konfiguracja FTP z ENV lub body (TEMP: local test FTP)
    const envConfig = {
      host: '127.0.0.1',
      port: Number(process.env.FTP_PORT || '2122') || 2122,
      user: process.env.FTP_USER || 'testuser',
      password: process.env.FTP_PASSWORD || 'test123',
      secure: String(process.env.FTP_SECURE || '').toLowerCase() === 'true' || process.env.FTP_SECURE === '1',
      baseDir: process.env.FTP_BASE_DIR || ''
    }
    const finalFtp = {
      host: ftpConfig?.host || envConfig.host,
      port: Number(ftpConfig?.port || envConfig.port) || 2122,
      user: ftpConfig?.user || envConfig.user,
      password: ftpConfig?.password || envConfig.password,
      secure: typeof ftpConfig?.secure === 'boolean' ? ftpConfig.secure : envConfig.secure || false
    }
    if (!finalFtp.host || !finalFtp.user || !finalFtp.password) {
      return NextResponse.json({ success: false, error: 'Brak konfiguracji FTP' }, { status: 400 })
    }

    const baseDir = envConfig.baseDir ? envConfig.baseDir.replace(/^\/+|\/+$/g,'') : ''
    const remoteRoot = baseDir || '.'

    const localRoot = path.join(process.cwd(), 'tmp', 'ftp-export', jobId)
    const entries = await fs.readdir(localRoot, { withFileTypes: true })
    const files = entries.filter(ent => ent.isFile())

    const operations = []
    operations.push({ type: 'ensureDir', path: remoteRoot })
    for (const f of files) {
      const localPath = path.join(localRoot, f.name)
      operations.push({
        type: 'uploadFile',
        remoteDir: remoteRoot,
        remoteName: f.name,
        localPath
      })
    }

    await uploadToFtp(finalFtp, operations)

    return NextResponse.json({ success: true, uploaded: files.map(f => f.name), remoteDir: remoteRoot })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd wysyłki na FTP' }, { status: 500 })
  }
}


