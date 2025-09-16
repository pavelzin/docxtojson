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
    const { articleIds } = await request.json()
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Brak artykułów do przygotowania' }, { status: 400 })
    }

    // Google Drive auth (wymagane przy obrazach)
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
    if (!canUseDrive && process.env.GDRIVE_ACCESS_TOKEN && process.env.GDRIVE_REFRESH_TOKEN) {
      try {
        setCredentials({ access_token: process.env.GDRIVE_ACCESS_TOKEN, refresh_token: process.env.GDRIVE_REFRESH_TOKEN })
        canUseDrive = true
      } catch {}
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

      // Obraz (opcjonalnie)
      if (canUseDrive) {
        try {
          const img = await downloadLargestTopImage(a.drive_path)
          if (img) {
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
        }
      }

      bulkArticles.push(exportedArticle)
    }

    const localJsonPath = path.join(localRoot, 'articles.json')
    await fs.writeFile(localJsonPath, Buffer.from(JSON.stringify({ articles: bulkArticles }, null, 2)))
    savedFiles.push('articles.json')

    return NextResponse.json({ 
      success: true, 
      jobId, 
      files: savedFiles, 
      count: bulkArticles.length,
      articles: bulkArticles.map(a => ({
        articleId: a.articleId,
        title: a.title,
        imageUrl: a.images?.[0]?.url || null,
        imageTitle: a.images?.[0]?.title || null,
        author: a.author,
        photoAuthor: a.photoAuthor || null
      }))
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd przygotowania eksportu' }, { status: 500 })
  }
}


