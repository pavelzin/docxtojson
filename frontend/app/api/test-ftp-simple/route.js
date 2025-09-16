import { NextResponse } from 'next/server'
import * as ftp from 'basic-ftp'

export async function GET(request) {
  const client = new ftp.Client(15000)
  
  try {
    console.log('🔌 Próba połączenia z FTP...')
    
    // Włącz verbose dla debugowania
    client.ftp.verbose = true
    
    const config = {
      host: '127.0.0.1',
      port: 2122,
      user: 'testuser',
      password: 'test123',
      secure: false
    }
    
    console.log('📡 Konfiguracja FTP:', config)
    
    await client.access(config)
    console.log('✅ Połączenie udane!')
    
    // Test prostej operacji
    const list = await client.list()
    console.log('📁 Lista plików:', list)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Połączenie FTP udane!',
      files: list.map(f => f.name)
    })
    
  } catch (error) {
    console.error('❌ Błąd FTP:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  } finally {
    client.close()
  }
}
