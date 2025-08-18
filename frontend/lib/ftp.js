import * as ftp from 'basic-ftp'
import { Readable } from 'stream'

export async function uploadToFtp({ host, port = 21, user, password, secure = false }, operations) {
  const client = new ftp.Client(15000)
  client.ftp.verbose = false
  try {
    await client.access({ host, port, user, password, secure })
    for (const op of operations) {
      if (op.type === 'ensureDir') {
        await client.ensureDir(op.path)
      } else if (op.type === 'delayMs') {
        const ms = Math.max(0, Number(op.ms || 0))
        await new Promise((resolve) => setTimeout(resolve, ms))
      } else if (op.type === 'uploadBuffer') {
        await client.ensureDir(op.remoteDir)
        const buf = op.buffer instanceof Uint8Array ? op.buffer : Buffer.from(op.buffer)
        const stream = Readable.from(buf)
        // Po ensureDir jesteśmy już w katalogu docelowym
        await client.uploadFrom(stream, op.remoteName)
      }
    }
  } finally {
    client.close()
  }
}


