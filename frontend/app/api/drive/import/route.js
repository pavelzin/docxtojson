import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import path from 'path';
import { promises as fs } from 'fs';
import { setCredentials, downloadDocxFile, getFileParentId, findBestArticleImage, drive } from '@/lib/google-drive';
import { DocxParser } from '@/lib/docx-parser';
import { queries, initializeDatabase } from '@/lib/database';

// Funkcja do pobierania tokenów z cookies
function getTokensFromCookies() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('google_access_token')?.value;
  const refreshToken = cookieStore.get('google_refresh_token')?.value;
  
  if (!accessToken) {
    return null;
  }
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
}

export async function POST(request) {
  try {
    // Upewnij się, że baza (w tym migracje) jest gotowa
    await initializeDatabase();
    // Sprawdź autoryzację
    const tokens = getTokensFromCookies();
    if (!tokens) {
      return NextResponse.json(
        { success: false, error: 'Brak autoryzacji Google Drive' },
        { status: 401 }
      );
    }

    // Ustaw tokeny autoryzacji
    setCredentials(tokens);

    const body = await request.json();
    const { fileId, fileName, articlePath } = body;

    if (!fileId || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Brak wymaganych parametrów (fileId, fileName)' },
        { status: 400 }
      );
    }

    // Pobierz plik DOCX z Google Drive
    console.log(`Pobieranie pliku ${fileName} (${fileId}) z Google Drive...`);
    const docxBuffer = await downloadDocxFile(fileId);

    // Konwertuj DOCX na artykuł JSON
    console.log(`Konwersja pliku ${fileName} na JSON...`);
    const parser = new DocxParser();
    const article = await parser.convertToArticle(docxBuffer, fileName, articlePath);

    // Znajdź przypisany obraz: weź rodzica (folder artykułu) i wybierz największy akceptowalny plik graficzny
    const parentFolderId = await getFileParentId(fileId);
    if (parentFolderId) {
      // Szukaj tylko w bieżącym folderze (bez podfolderów)
      const bestImage = await findBestArticleImage(parentFolderId);
      if (bestImage) {
        article.imageFilename = bestImage.name;
        // Pobierz zawartość obrazu i zapisz lokalnie
        try {
          const media = await drive.files.get({ fileId: bestImage.id, alt: 'media' }, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(media.data);
          const relPath = String(articlePath || article.drive_path || '').split('/').filter(Boolean);
          const localDir = path.join(process.cwd(), 'public', 'images', ...relPath);
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, bestImage.name), buffer);
        } catch (e) {
          console.warn('[IMPORT] Nie udało się zapisać obrazu lokalnie:', e.message);
        }
      }
    }

    // Sprawdź czy artykuł z tym tytułem już istnieje
    const existingArticle = await queries.getArticleByTitle(article.title);
    if (existingArticle) {
      return NextResponse.json(
        { success: false, error: `Artykuł "${article.title}" już istnieje w bazie danych` },
        { status: 409 }
      );
    }

    // Zapisz artykuł do bazy danych
    console.log(`Zapisywanie artykułu "${article.title}" do bazy...`);
    await queries.insertArticle(
      article.articleId,
      article.title,
      article.titleHotnews,
      article.titleSocial,
      article.titleSeo,
      article.lead,
      article.description,
      article.author,
      JSON.stringify(article.sources),
      JSON.stringify(article.categories),
      JSON.stringify(article.tags),
      article.status,
      article.imported_from,
      article.drive_path,
      article.original_filename
    );

    // Jeśli udało się znaleźć obraz, zaktualizuj kolumnę w bazie
    if (article.imageFilename) {
      await queries.setArticleImageFilename(article.articleId, article.imageFilename);
    }

    // Oznacz pola jako wygenerowane ręcznie (z parsera)
    const aiFields = {
      title: { isAI: false, confidence: 1.0 },
      lead: { isAI: false, confidence: 1.0 },
      description: { isAI: false, confidence: 1.0 },
      // Te pola będą później wygenerowane przez AI
      title_hotnews: { isAI: true, confidence: 0.0 },
      title_social: { isAI: true, confidence: 0.0 },
      title_seo: { isAI: true, confidence: 0.0 },
      categories: { isAI: true, confidence: 0.8 },
      tags: { isAI: true, confidence: 0.0 }
    };

    // Zapisz informacje o polach AI
    for (const [fieldName, fieldInfo] of Object.entries(aiFields)) {
      await queries.createAIField({
        article_id: article.articleId,
        field_name: fieldName,
        is_ai_generated: fieldInfo.isAI,
        confidence_score: fieldInfo.confidence,
        original_value: fieldInfo.isAI ? '' : (article[fieldName] || ''),
        ai_prompt: fieldInfo.isAI ? `Generate ${fieldName} for article` : null
      });
    }

    console.log(`✅ Artykuł "${article.title}" został pomyślnie zaimportowany!`);

    return NextResponse.json({
      success: true,
      article: {
        id: article.articleId,
        title: article.title,
        fileName: fileName,
        path: articlePath
      },
      message: `Artykuł "${article.title}" został zaimportowany`
    });

  } catch (error) {
    console.error('Błąd importu z Google Drive:', error);
    
    // Sprawdź różne typy błędów
    if (error.code === 401 || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Sesja Google Drive wygasła. Zaloguj się ponownie.' },
        { status: 401 }
      );
    }

    if (error.code === 404) {
      return NextResponse.json(
        { success: false, error: 'Plik nie został znaleziony na Google Drive' },
        { status: 404 }
      );
    }

    if (error.message?.includes('konwersji')) {
      return NextResponse.json(
        { success: false, error: `Błąd konwersji DOCX: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Błąd podczas importu pliku' },
      { status: 500 }
    );
  }
} 