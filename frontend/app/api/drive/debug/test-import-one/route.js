import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  setCredentials, 
  findMonthFolderId, 
  findArticleFolderId, 
  getDocxFiles, 
  downloadDocxFile,
  findBestArticleImage,
  findBestArticleImageDeep
} from '@/lib/google-drive';
import { DocxParser } from '@/lib/docx-parser';
import { queries, initializeDatabase } from '@/lib/database';

function getTokensFromCookies() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('google_access_token')?.value;
  const refreshToken = cookieStore.get('google_refresh_token')?.value;
  if (!accessToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

export async function POST(request) {
  try {
    await initializeDatabase();
    const tokens = getTokensFromCookies();
    if (!tokens) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    setCredentials(tokens);

    const body = await request.json();
    const { path } = body; // np. "STYCZEŃ 2025/Nazwa folderu artykułu"
    if (!path) return NextResponse.json({ success: false, error: 'Podaj path w body' }, { status: 400 });

    const parts = path.split('/').filter(Boolean);
    const monthName = parts[0];
    const articleName = parts.slice(1).join('/');

    const monthId = await findMonthFolderId(monthName);
    if (!monthId) return NextResponse.json({ success: false, error: `Brak miesiąca: ${monthName}` }, { status: 404 });
    const articleFolderId = await findArticleFolderId(monthId, articleName);
    if (!articleFolderId) return NextResponse.json({ success: false, error: `Brak artykułu: ${articleName}` }, { status: 404 });

    const docxFiles = await getDocxFiles(articleFolderId);
    if (!docxFiles.length) return NextResponse.json({ success: false, error: 'Brak DOCX w folderze' }, { status: 404 });
    const docx = docxFiles[0];

    const buffer = await downloadDocxFile(docx.id);
    const parser = new DocxParser();
    const article = await parser.convertToArticle(buffer, docx.name, path);

    // Szukaj obrazów
    let bestImage = await findBestArticleImage(articleFolderId);
    if (!bestImage) bestImage = await findBestArticleImageDeep(articleFolderId);
    if (bestImage) article.imageFilename = bestImage.name;

    // Nie zapisuj do bazy — tylko zwróć, żeby obejrzeć wynik
    return NextResponse.json({
      success: true,
      path,
      docxPicked: docx,
      articlePreview: article,
      imagePicked: bestImage || null
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd test-import-one' }, { status: 500 });
  }
}








