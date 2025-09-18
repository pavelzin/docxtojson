import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import path from 'path'
import { promises as fs } from 'fs'
import { queries } from '@/lib/database'
import { drive, findMonthFolderId, findArticleFolderId, getImageFiles, setCredentials } from '@/lib/google-drive'

function slugifyFilenameSegment(filename) {
  const polishChars = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  }
  return String(filename || '')
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => polishChars[ch] || ch)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getFileExtension(name) {
  const n = String(name || '')
  const idx = n.lastIndexOf('.')
  if (idx === -1 || idx === n.length - 1) return ''
  return n.slice(idx + 1)
}

function makeUniqueName(baseWithoutExt, ext, usedNames) {
  let candidate = ext ? `${baseWithoutExt}.${ext}` : baseWithoutExt
  let counter = 1
  while (usedNames.has(candidate)) {
    candidate = ext ? `${baseWithoutExt}-${counter}.${ext}` : `${baseWithoutExt}-${counter}`
    counter += 1
  }
  usedNames.add(candidate)
  return candidate
}

// Parser photo author z oryginalnej nazwy pliku (przed sanityzacją)
function extractPhotoAuthorFromFilename(filename) {
  try {
    if (!filename || typeof filename !== 'string') return null
    const base = filename.split('/').pop()
    const withoutExt = base.replace(/\.[^.]+$/, '')
    const segments = withoutExt.split('_')
    const candidate = segments[segments.length - 1].trim()
    return candidate || null
  } catch {
    return null
  }
}

async function downloadLargestTopImage(drivePath) {
  console.log('🖼️ Próba pobrania obrazu dla:', drivePath)
  if (!drivePath) {
    console.log('❌ Brak drivePath')
    return null
  }
  const [monthName, ...rest] = drivePath.split('/')
  const articleName = rest.join('/')
  console.log('🔍 Szukam miesiąca:', monthName)
  
  const monthId = await findMonthFolderId(monthName)
  if (!monthId) {
    console.log('❌ Nie znaleziono miesiąca:', monthName)
    return null
  }
  console.log('✅ Znaleziono miesiąc, szukam folder artykułu:', articleName)
  
  const articleFolderId = await findArticleFolderId(monthId, articleName)
  if (!articleFolderId) {
    console.log('❌ Nie znaleziono folderu artykułu:', articleName)
    return null
  }
  console.log('✅ Znaleziono folder, pobieranie obrazów...')
  
  const topImages = await getImageFiles(articleFolderId)
  if (!topImages || topImages.length === 0) {
    console.log('❌ Brak obrazów w folderze')
    return null
  }
  console.log('✅ Znaleziono', topImages.length, 'obrazów, pobieranie największego...')
  
  const best = topImages.reduce((a, b) => (b.size > a.size ? b : a))
  console.log('✅ Pobieranie obrazu:', best.name)
  
  const media = await drive.files.get({ fileId: best.id, alt: 'media' }, { responseType: 'arraybuffer' })
  console.log('✅ Obraz pobrany!')
  return { buffer: Buffer.from(media.data), name: best.name }
}

export async function POST(request) {
  try {
    const { articleIds } = await request.json()
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Brak artykułów do przygotowania' }, { status: 400 })
    }

    // Google Drive auth (WYMAGANE dla eksportu FTP)
    let canUseDrive = false
    console.log('🔍 FTP-PREPARE: Sprawdzam autoryzację Google Drive...')
    
    try {
      const cookieStore = cookies()
      const accessToken = cookieStore.get('google_access_token')?.value
      const refreshToken = cookieStore.get('google_refresh_token')?.value
      console.log('🔍 Cookies:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken })
      if (accessToken) {
        setCredentials({ access_token: accessToken, refresh_token: refreshToken })
        canUseDrive = true
        console.log('✅ Autoryzacja z cookies')
      }
    } catch (e) {
      console.log('❌ Błąd cookies:', e.message)
    }
    
    if (!canUseDrive && process.env.GDRIVE_ACCESS_TOKEN && process.env.GDRIVE_REFRESH_TOKEN) {
      try {
        setCredentials({ access_token: process.env.GDRIVE_ACCESS_TOKEN, refresh_token: process.env.GDRIVE_REFRESH_TOKEN })
        canUseDrive = true
        console.log('✅ Autoryzacja z ENV')
      } catch (e) {
        console.log('❌ Błąd ENV:', e.message)
      }
    }
    
    console.log('🔍 canUseDrive:', canUseDrive)
    
    // BRAK AUTORYZACJI = BRAK EKSPORTU
    if (!canUseDrive) {
      console.log('❌ BRAK AUTORYZACJI - zwracam błąd')
      return NextResponse.json({ 
        success: false, 
        error: 'Brak autoryzacji Google Drive. Musisz się zalogować aby eksportować artykuły z obrazami.',
        needsAuth: true 
      }, { status: 401 })
    }

    // Utwórz katalog roboczy
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const jobId = stamp
    const localRoot = path.join(process.cwd(), 'tmp', 'ftp-export', jobId)
    await fs.mkdir(localRoot, { recursive: true })

    const usedNames = new Set()
    const bulkArticles = []
    const savedFiles = []

    for (const id of articleIds) {
      const a = await queries.getArticleById(id)
      if (!a) continue

      const exportedArticle = {
        articleId: a.article_id,
        title: a.title,
        author: 'red.',
        sources: ['polsatnews.pl']
      }
      if (a.title_hotnews) exportedArticle.titleHotnews = a.title_hotnews
      if (a.title_social) exportedArticle.titleSocial = a.title_social
      if (a.title_seo) exportedArticle.titleSeo = a.title_seo
      if (a.lead) exportedArticle.lead = a.lead
      if (a.description) exportedArticle.description = a.description
      if (a.categories) exportedArticle.categories = JSON.parse(a.categories || '[]')
      if (a.tags) exportedArticle.tags = JSON.parse(a.tags || '[]')

      // Obraz z Google Drive (zawsze wymagany)
      {
        try {
          const img = await downloadLargestTopImage(a.drive_path)
          if (img) {
            // 🎯 NAJPIERW parsuj photoAuthor z oryginalnej nazwy pliku (priorytet dla Drive)
            const photoAuthor = extractPhotoAuthorFromFilename(img.name) || a.photo_author
            if (photoAuthor) {
              exportedArticle.photoAuthor = photoAuthor
            }
            
            // Potem sanityzuj nazwę dla lokalnego pliku
            const ext = getFileExtension(img.name) || 'jpg'
            const titleSlug = slugifyFilenameSegment(a.title).replace(/\.+/g, '-')
            const baseName = slugifyFilenameSegment(`${a.article_id}_${titleSlug}`)
            const finalName = makeUniqueName(baseName, ext, usedNames)
            const localImagePath = path.join(localRoot, finalName)
            await fs.writeFile(localImagePath, img.buffer)
            exportedArticle.images = [{ url: `file:///${finalName}`, title: a.title_social || a.title }]
            savedFiles.push(finalName)
          }
        } catch (e) {
          console.warn('[FTP-PREPARE] Image download failed:', e?.message || e)
          // Jeśli błąd sieci - kontynuuj bez obrazu zamiast crashować
          if (e?.code === 'ENOTFOUND' || e?.message?.includes('googleapis.com')) {
            console.log('🌐 Błąd sieci - pomijam obraz dla artykułu:', a.article_id)
          }
        }
      }

      bulkArticles.push(exportedArticle)
    }

    const localJsonPath = path.join(localRoot, 'articles.json')
    await fs.writeFile(localJsonPath, Buffer.from(JSON.stringify({ articles: bulkArticles }, null, 2)))
    savedFiles.push('articles.json')

    // MINIMALNY response - tylko to co potrzebne
    const responseData = {
      success: true,
      jobId,
      files: savedFiles,
      count: bulkArticles.length,
      // Nie wysyłamy całych articles - za duży response może być problemem
      articles: bulkArticles.map(a => ({
        articleId: a.articleId,
        title: a.title.substring(0, 50) + (a.title.length > 50 ? '...' : ''), // Skróć tytuły
        photoAuthor: a.photoAuthor || null
      }))
    }

    console.log('🎯 FTP-PREPARE FINISHED - Response size:', JSON.stringify(responseData).length, 'bytes')
    console.log('🎯 Sending response to frontend...')

    const response = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=300',
      },
    })

    console.log('🎯 Response created, returning...')
    return response
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd przygotowania eksportu' }, { status: 500 })
  }
}


