import * as ftp from 'basic-ftp'
import { Readable } from 'stream'
import { promises as fs } from 'fs'

export async function uploadToFtp({ host, port = 21, user, password, secure = false }, operations) {
  const client = new ftp.Client(15000)
  client.ftp.verbose = true  // Enable debug logs
  
  try {
    console.log(`🔌 FTP CONNECT: ${user}@${host}:${port}`)
    
    await client.access({ 
      host: host, 
      port: port, 
      user: user, 
      password: password, 
      secure: secure || false
    })
    
    console.log('✅ FTP CONNECTED!')
    
    for (const op of operations) {
      console.log(`🔧 FTP Operation: ${op.type}`)
      
      if (op.type === 'ensureDir') {
        await client.ensureDir(op.path)
      } else if (op.type === 'delayMs') {
        const ms = Math.max(0, Number(op.ms || 0))
        await new Promise((resolve) => setTimeout(resolve, ms))
      } else if (op.type === 'uploadBuffer') {
        await client.ensureDir(op.remoteDir)
        const buf = op.buffer instanceof Uint8Array ? op.buffer : Buffer.from(op.buffer)
        const stream = Readable.from(buf)
        await client.uploadFrom(stream, op.remoteName)
        console.log(`📤 Uploaded buffer: ${op.remoteName}`)
      } else if (op.type === 'uploadFile') {
        await client.ensureDir(op.remoteDir)
        await client.uploadFrom(op.localPath, op.remoteName)
        console.log(`📤 Uploaded file: ${op.remoteName}`)
      }
    }
    
    console.log('✅ All FTP operations completed!')
    
  } catch (error) {
    console.error('❌ FTP ERROR:', error.message)
    throw error
  } finally {
    client.close()
  }
}


