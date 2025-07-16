import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  setCredentials, 
  getMonthFolders, 
  getArticleFolders, 
  getDocxFiles,
  downloadDocxFile
} from '@/lib/google-drive';
import { DocxParser } from '@/lib/docx-parser';
import { queries } from '@/lib/database';

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