import { NextResponse } from 'next/server'
import { uploadToFtp } from '@/lib/ftp'

export async function GET(request) {
  try {
    const ftpConfig = {
      host: '127.0.0.1',
      port: 2122,
      user: 'testuser',
      password: 'test123',
      secure: false
    }

    console.log('🧪 Direct FTP test...')

    // Test prostego uploadu
    const testContent = `Direct FTP Test
Timestamp: ${new Date().toISOString()}
This is a direct test bypassing authentication.
`

    const operations = [
      { 
        type: 'ensureDir', 
        path: '/direct-test' 
      },
      {
        type: 'uploadBuffer',
        remoteDir: '/direct-test',
        remoteName: 'direct-test.txt',
        buffer: Buffer.from(testContent, 'utf-8')
      }
    ]

    await uploadToFtp(ftpConfig, operations)

    return NextResponse.json({ 
      success: true, 
      message: 'Direct FTP test successful!',
      file: 'direct-test.txt'
    })

  } catch (error) {
    console.error('❌ Direct FTP test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
