import { NextResponse } from 'next/server'
import { uploadToFtp } from '@/lib/ftp'

export async function POST(request) {
  try {
    const { test = false } = await request.json()

    // Dane testowego serwera FTP
    const ftpConfig = {
      host: '127.0.0.1',
      port: 2122,
      user: 'testuser',
      password: 'test123',
      secure: false
    }

    console.log('🧪 Testowanie połączenia FTP...', ftpConfig)

    // Test - wyślij prosty plik tekstowy
    const testContent = `Test FTP upload
Timestamp: ${new Date().toISOString()}
From: DOCX Editor Frontend
`

    const operations = [
      { 
        type: 'ensureDir', 
        path: '/test' 
      },
      {
        type: 'uploadBuffer',
        remoteDir: '/test',
        remoteName: 'test-upload.txt',
        buffer: Buffer.from(testContent, 'utf-8')
      }
    ]

    await uploadToFtp(ftpConfig, operations)

    return NextResponse.json({ 
      success: true, 
      message: 'Test FTP upload successful!',
      config: {
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.user
      }
    })

  } catch (error) {
    console.error('❌ FTP Test Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
