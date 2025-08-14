import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import path from 'path';
import { promises as fs } from 'fs';
import { 
  setCredentials, 
  getMonthFolders, 
  getArticleFolders, 
  getDocxFiles,
  downloadDocxFile,
  findBestArticleImage,
  drive
} from '@/lib/google-drive';
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
    console.log('🚀 Rozpoczynanie automatycznego importu z Google Drive...');
    
    // Sprawdź autoryzację
    const tokens = getTokensFromCookies();
    if (!tokens) {
      return NextResponse.json({ 
        error: 'Brak autoryzacji Google Drive. Zaloguj się najpierw.' 
      }, { status: 401 });
    }

    // Ustaw tokeny autoryzacji
    setCredentials(tokens);

    const results = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: []
    };

    // 1. Pobierz miesiące (foldery główne)
    console.log('📂 Pobieranie listy miesięcy...');
    const months = await getMonthFolders();
    
    for (const month of months) {
      console.log(`📅 Przetwarzanie miesiąca: ${month.name}`);
      
      // 2. Pobierz tytuły artykułów (podfoldery)
      const articleFolders = await getArticleFolders(month.id);
      
      for (const articleFolder of articleFolders) {
        console.log(`📄 Przetwarzanie artykułu: ${articleFolder.name}`);
        
        // 3. Pobierz pliki DOCX z tego artykułu
        const docxFiles = await getDocxFiles(articleFolder.id);
        
        for (const docxFile of docxFiles) {
          results.processed++;
          
          try {
            console.log(`⬇️  Pobieranie: ${docxFile.name}`);
            
            // Pobierz i skonwertuj plik
            const fileBuffer = await downloadDocxFile(docxFile.id);
            const parser = new DocxParser();
            const drivePath = `${month.name}/${articleFolder.name}`;
            const article = await parser.convertToArticle(fileBuffer, docxFile.name, drivePath);

            // Znajdź największe zdjęcie w folderze artykułu i dodaj jego nazwę do JSON
            // Szukaj tylko w bieżącym folderze (bez podfolderów)
            const bestImage = await findBestArticleImage(articleFolder.id);
            if (bestImage) {
              article.imageFilename = bestImage.name;
              // Pobierz obraz i zapisz lokalnie
              try {
                const media = await drive.files.get({ fileId: bestImage.id, alt: 'media' }, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(media.data);
                const rel = `${month.name}/${articleFolder.name}`.split('/').filter(Boolean);
                const dir = path.join(process.cwd(), 'public', 'images', ...rel);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(path.join(dir, bestImage.name), buffer);
              } catch (e) {
                console.warn(`[sync] Nie udało się zapisać obrazu lokalnie: ${e.message}`);
              }
            }
            
            // Sprawdź czy artykuł z tym tytułem już istnieje w bazie
            const existing = await queries.getArticleByTitle(article.title);
            
            if (existing) {
              console.log(`⏭️  Pomijam istniejący: ${article.title}`);
              results.skipped++;
              continue;
            }
            
            // Uzupełnij metadane
            article.imported_from = 'google_drive_sync';
            article.drive_path = drivePath;
            article.original_filename = docxFile.name;
            article.status = 'draft';
            
            // Zapisz do bazy
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

            // Jeżeli znaleziono zdjęcie – zapisz je do bazy
            if (article.imageFilename) {
              await queries.setArticleImageFilename(article.articleId, article.imageFilename);
            }
            
            console.log(`✅ Zaimportowano: ${article.title}`);
            results.imported++;
            
          } catch (error) {
            console.error(`❌ Błąd importu ${docxFile.name}:`, error.message);
            results.errors.push({
              file: docxFile.name,
              path: `${month.name}/${articleFolder.name}`,
              error: error.message
            });
          }
        }
      }
    }
    
    console.log('🎉 Synchronizacja zakończona:', results);
    return NextResponse.json({
      success: true,
      message: `Synchronizacja zakończona. Zaimportowano ${results.imported} artykułów.`,
      results
    });

  } catch (error) {
    console.error('Błąd synchronizacji z Google Drive:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Błąd serwera podczas synchronizacji'
    }, { status: 500 });
  }
} 