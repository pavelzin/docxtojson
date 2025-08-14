import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import path from 'path';
import { promises as fs } from 'fs';
import { setCredentials, findMonthFolderId, findArticleFolderId, drive, getImageFilesRecursive } from '@/lib/google-drive';

// GET /api/drive/image?path=MONTH/ARTICLE_NAME&name=FILENAME.jpg
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const name = searchParams.get('name');

    if (!path || !name) {
      return NextResponse.json({ success: false, error: 'Brak wymaganych parametrów (path, name)' }, { status: 400 });
    }

    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowa ścieżka (oczekiwano MONTH/ARTICLE_FOLDER)' }, { status: 400 });
    }
    const monthName = parts[0];
    const articleName = parts[1];

    // 1) Spróbuj zwrócić obraz bezpośrednio z dysku (już ściągnięty wcześniej)
    const safeRel = [monthName, articleName, name].map(s => String(s).replace(/[\\/]/g, '_').trim());
    const localFilePath = path.join(process.cwd(), 'public', 'images', ...safeRel);
    try {
      const fileBuffer = await fs.readFile(localFilePath);
      const ext = (name.split('.').pop() || '').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`
        }
      });
    } catch {}

    // 2) Jeśli nie ma pliku lokalnie – pobierz z Drive, zapisz lokalnie i zwróć
    const cookieStore = cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;
    const refreshToken = cookieStore.get('google_refresh_token')?.value;
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji Google Drive' }, { status: 401 });
    }
    setCredentials({ access_token: accessToken, refresh_token: refreshToken });

    const monthFolderId = await findMonthFolderId(monthName);
    if (!monthFolderId) {
      return NextResponse.json({ success: false, error: `Nie znaleziono miesiąca: ${monthName}` }, { status: 404 });
    }
    const articleFolderId = await findArticleFolderId(monthFolderId, articleName);
    if (!articleFolderId) {
      return NextResponse.json({ success: false, error: `Nie znaleziono artykułu: ${articleName}` }, { status: 404 });
    }

    // Najpierw spróbuj znaleźć plik bezpośrednio w folderze
    const safeName = name.replace(/'/g, "\\'");
    let listResp = await drive.files.list({
      q: `'${articleFolderId}' in parents and name='${safeName}' and trashed=false`,
      fields: 'files(id, name, mimeType, size)'
    });
    let imageFile = (listResp.data.files || [])[0];

    // Jeśli nie znaleziono – poszukaj rekurencyjnie w podfolderach
    if (!imageFile) {
      const allImages = await getImageFilesRecursive(articleFolderId);
      const lowerTarget = name.toLowerCase();
      const found = allImages.find(f => (f.name || '').toLowerCase() === lowerTarget);
      if (found) {
        imageFile = found;
      }
    }
    if (!imageFile) {
      return NextResponse.json({ success: false, error: 'Plik obrazu nie znaleziony' }, { status: 404 });
    }

    const mediaResp = await drive.files.get({ fileId: imageFile.id, alt: 'media' }, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(mediaResp.data);

    // Zapisz lokalnie do public/images/{month}/{article}/{name}
    const dirPath = path.dirname(localFilePath);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(localFilePath, buffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': imageFile.mimeType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${encodeURIComponent(imageFile.name)}"`
      }
    });
  } catch (error) {
    console.error('Błąd pobierania obrazu z Drive:', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera podczas pobierania obrazu' }, { status: 500 });
  }
}


