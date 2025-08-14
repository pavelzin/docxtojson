import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { queries } from '@/lib/database'
import { uploadToFtp } from '@/lib/ftp'
import { drive, findMonthFolderId, findArticleFolderId, getImageFiles, setCredentials } from '@/lib/google-drive'

function sanitizeDirName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

async function downloadDriveImageByName(drivePath, imageName) {
  if (!drivePath || !imageName) return null
  const [monthName, ...rest] = drivePath.split('/')
  const articleName = rest.join('/')
  const monthId = await findMonthFolderId(monthName)
  if (!monthId) return null
  const articleFolderId = await findArticleFolderId(monthId, articleName)
  if (!articleFolderId) return null

  const safeName = imageName.replace(/'/g, "\\'")
  const list = await drive.files.list({
    q: `'${articleFolderId}' in parents and name='${safeName}' and trashed=false`,
    fields: 'files(id, name, mimeType)'
  })
  const file = (list.data.files || [])[0]
  let target = file
  if (!target) return null
  const media = await drive.files.get({ fileId: target.id, alt: 'media' }, { responseType: 'arraybuffer' })
  return { buffer: Buffer.from(media.data), name: target.name }
}

// Uwaga: świadomie nie szukamy w podfolderach przy eksporcie FTP (na życzenie)

async function downloadLargestTopImage(drivePath) {
  if (!drivePath) return null
  const [monthName, ...rest] = drivePath.split('/')
  const articleName = rest.join('/')
  const monthId = await findMonthFolderId(monthName)
  if (!monthId) return null
  const articleFolderId = await findArticleFolderId(monthId, articleName)
  if (!articleFolderId) return null
  const topImages = await getImageFiles(articleFolderId)
  if (!topImages || topImages.length === 0) return null
  const best = topImages.reduce((a, b) => (b.size > a.size ? b : a))
  const media = await drive.files.get({ fileId: best.id, alt: 'media' }, { responseType: 'arraybuffer' })
  return { buffer: Buffer.from(media.data), name: best.name }
}

export async function POST(request) {
  try {
    const { articleIds, ftpConfig } = await request.json()
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Brak artykułów do eksportu' }, { status: 400 })
    }
    // Wczytaj konfigurację z ENV (fallback)
    const envConfig = {
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT || '21') || 21,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: String(process.env.FTP_SECURE || '').toLowerCase() === 'true' || process.env.FTP_SECURE === '1',
      baseDir: process.env.FTP_BASE_DIR || ''
    }
    const finalFtp = {
      host: ftpConfig?.host || envConfig.host,
      port: Number(ftpConfig?.port || envConfig.port || 21) || 21,
      user: ftpConfig?.user || envConfig.user,
      password: ftpConfig?.password || envConfig.password,
      secure: typeof ftpConfig?.secure === 'boolean' ? ftpConfig.secure : envConfig.secure || false
    }
    if (!finalFtp.host || !finalFtp.user || !finalFtp.password) {
      return NextResponse.json({ success: false, error: 'Brak konfiguracji FTP' }, { status: 400 })
    }

    // Ustaw poświadczenia Drive jeśli dostępne (żeby pobrać obraz)
    let canUseDrive = false
    try {
      const cookieStore = cookies()
      const accessToken = cookieStore.get('google_access_token')?.value
      const refreshToken = cookieStore.get('google_refresh_token')?.value
      if (accessToken) {
        setCredentials({ access_token: accessToken, refresh_token: refreshToken })
        canUseDrive = true
      }
    } catch {}
    // fallback: jeśli brak cookies, a w ENV są stałe tokeny (dev), pozwól pobrać obraz
    if (!canUseDrive && process.env.GDRIVE_ACCESS_TOKEN && process.env.GDRIVE_REFRESH_TOKEN) {
      try {
        setCredentials({ access_token: process.env.GDRIVE_ACCESS_TOKEN, refresh_token: process.env.GDRIVE_REFRESH_TOKEN })
        canUseDrive = true
      } catch {}
    }
    console.log(`[FTP-EXPORT] canUseDrive=${canUseDrive}, ftpHost=${finalFtp.host}, ftpPort=${finalFtp.port}`)

    const operations = []
    const results = []

    const isBulk = articleIds.length > 1

    // Wyznacz katalog docelowy
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const base = envConfig.baseDir ? `/${envConfig.baseDir.replace(/^\/+|\/+$/g,'')}` : ''
    const bulkRemoteDir = `${base}/${today}`

    // W trybie bulk przygotujemy tablicę artykułów do jednego JSON
    const bulkArticles = []

    for (const id of articleIds) {
      const a = await queries.getArticleById(id)
      if (!a) continue

      // Przygotuj strukturę eksportową (bez pól wewnętrznych jak imageFilename)
      const exportedArticle = {
        articleId: a.article_id,
        title: a.title,
        // opcjonalne niżej dodamy tylko jeśli istnieją
      }
      if (a.title_hotnews) exportedArticle.titleHotnews = a.title_hotnews
      if (a.title_social) exportedArticle.titleSocial = a.title_social
      if (a.title_seo) exportedArticle.titleSeo = a.title_seo
      if (a.lead) exportedArticle.lead = a.lead
      if (a.description) exportedArticle.description = a.description
      if (a.author) exportedArticle.author = a.author
      if (a.photo_author) exportedArticle.photoAuthor = a.photo_author
      if (a.sources) exportedArticle.sources = JSON.parse(a.sources || '[]')
      if (a.categories) exportedArticle.categories = JSON.parse(a.categories || '[]')
      if (a.tags) exportedArticle.tags = JSON.parse(a.tags || '[]')

      // Jeśli mamy przypiętą nazwę obrazu, dodaj images nawet gdy nie uda się pobrać pliku (file:///nazwa_pliku)
      if (a.image_filename) {
        // Fallback: gdy photo_author jest puste, spróbuj wyciągnąć z nazwy pliku
        const derivePhotoAuthor = (filename) => {
          try {
            if (!filename || typeof filename !== 'string') return null;
            const base = String(filename).split('/').pop();
            const withoutExt = base.replace(/\.[^.]+$/, '');
            const segments = withoutExt.split('_');
            const candidate = segments[segments.length - 1].trim();
            return candidate || null;
          } catch {
            return null;
          }
        }
        const computedAuthor = a.photo_author || derivePhotoAuthor(a.image_filename);
        // Ustaw też top-level photoAuthor, jeśli brak, a udało się wyliczyć
        if (!exportedArticle.photoAuthor && computedAuthor) {
          exportedArticle.photoAuthor = computedAuthor;
        }
        exportedArticle.images = [
          {
            url: `file:///${a.image_filename}`,
            title: a.title_social || a.title
          }
        ]
      }

      // Katalog docelowy per artykuł albo wspólny
      const dirName = sanitizeDirName(a.title)
      const remoteDir = isBulk ? bulkRemoteDir : `${base}/${dirName}`
      operations.push({ type: 'ensureDir', path: remoteDir })
      console.log(`[FTP-EXPORT] Article ${a.article_id} -> dir=${remoteDir}, image_filename=${a.image_filename || '-'}, drive_path=${a.drive_path || '-'}`)

      // JSON
      // W trybie single dołączymy JSON po zebraniu obrazów; w bulk zbudujemy po pętli

      // Obraz (jeśli jest) – tylko z bieżącego folderu (bez podfolderów)
      if (canUseDrive) {
        try {
          let img = null
          if (a.image_filename) {
            console.log(`[FTP-EXPORT] Try direct image lookup: ${a.image_filename}`)
            img = await downloadDriveImageByName(a.drive_path, a.image_filename)
            console.log(`[FTP-EXPORT] Direct lookup result: ${img ? 'FOUND '+img.name : 'NOT FOUND'}`)
          }
          if (!img) {
            console.log(`[FTP-EXPORT] Try largest top-level image for: ${a.drive_path}`)
            img = await downloadLargestTopImage(a.drive_path)
            console.log(`[FTP-EXPORT] Top-level lookup result: ${img ? 'FOUND '+img.name : 'NOT FOUND'}`)
          }
          if (img) {
            // Upload obrazu i wpis do images z lokalnym URL-em file:///
            operations.push({
              type: 'uploadBuffer',
              remoteDir,
              remoteName: img.name,
              buffer: img.buffer
            })
            // Upewnij się, że URL odpowiada faktycznej nazwie pliku wrzuconego na FTP
            const derivePhotoAuthor = (filename) => {
              try {
                if (!filename || typeof filename !== 'string') return null;
                const base = String(filename).split('/').pop();
                const withoutExt = base.replace(/\.[^.]+$/, '');
                const segments = withoutExt.split('_');
                const candidate = segments[segments.length - 1].trim();
                return candidate || null;
              } catch {
                return null;
              }
            }
            const computedAuthor = a.photo_author || derivePhotoAuthor(img.name);
            if (!exportedArticle.photoAuthor && computedAuthor) {
              exportedArticle.photoAuthor = computedAuthor;
            }
            exportedArticle.images = [
              {
                url: `file:///${img.name}`,
                title: a.title_social || a.title
              }
            ]
            console.log(`[FTP-EXPORT] Queued image upload: ${img.name}`)
          }
        } catch (e) {
          console.warn(`[FTP-EXPORT] Image download failed: ${e.message}`)
        }
      }

      if (isBulk) {
        bulkArticles.push(exportedArticle)
      } else {
        // Single: zapisz JSON tego artykułu w jego katalogu
        const jsonBuffer = Buffer.from(JSON.stringify({ articles: [exportedArticle] }, null, 2))
        operations.push({
          type: 'uploadBuffer',
          remoteDir,
          remoteName: `${dirName}.json`,
          buffer: jsonBuffer
        })
      }

      results.push({ id: id, dir: remoteDir, hasImage: Array.isArray(exportedArticle.images) && exportedArticle.images.length > 0 })
    }

    // Wrzut JSON dla trybu bulk do katalogu z dzisiejszą datą
    if (isBulk) {
      operations.unshift({ type: 'ensureDir', path: bulkRemoteDir })
      const bulkJson = Buffer.from(JSON.stringify({ articles: bulkArticles }, null, 2))
      operations.push({
        type: 'uploadBuffer',
        remoteDir: bulkRemoteDir,
        remoteName: 'articles.json',
        buffer: bulkJson
      })
    }

    if (operations.length === 0) {
      return NextResponse.json({ success: false, error: 'Brak danych do eksportu' }, { status: 400 })
    }

    console.log(`[FTP-EXPORT] FTP operations queued: ${operations.length}`)
    await uploadToFtp(finalFtp, operations)
    console.log(`[FTP-EXPORT] FTP upload DONE`)

    return NextResponse.json({ success: true, uploaded: results })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd eksportu na FTP' }, { status: 500 })
  }
}


