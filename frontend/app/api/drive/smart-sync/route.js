import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  setCredentials, 
  getNewFilesFromDrive,
  getFilesFromSpecificMonth,
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
  let syncId = null;
  
  try {
    const body = await request.json();
    const { 
      syncType = 'incremental', // 'incremental', 'month', 'full'
      targetMonth = null,        // wymagane dla syncType='month'
      limitMonths = 2           // ile miesięcy sprawdzać dla incremental
    } = body;

    console.log(`🚀 Rozpoczynanie inteligentnej synchronizacji: ${syncType}`);
    
    // Sprawdź autoryzację
    const tokens = getTokensFromCookies();
    if (!tokens) {
      return NextResponse.json({ 
        error: 'Brak autoryzacji Google Drive. Zaloguj się najpierw.' 
      }, { status: 401 });
    }

    // Ustaw tokeny autoryzacji
    setCredentials(tokens);

    // Rozpocznij tracking synchronizacji
    syncId = await queries.startSync(syncType, targetMonth);

    const results = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      syncType,
      targetMonth
    };

    let filesToProcess = [];

    // Określ strategię pobierania plików
    switch (syncType) {
      case 'incremental':
        console.log(`🔄 Synchronizacja inkrementalna (ostatnie ${limitMonths} miesiące)`);
        
        // Pobierz datę ostatniej udanej synchronizacji
        const lastSync = await queries.getLastSuccessfulSync('incremental');
        const sinceDate = lastSync ? lastSync.completed_at : null;
        
        if (sinceDate) {
          console.log(`📅 Szukam plików nowszych niż: ${sinceDate}`);
        } else {
          console.log(`📅 Pierwsza synchronizacja - pobieram ostatnie ${limitMonths} miesiące`);
        }
        
        filesToProcess = await getNewFilesFromDrive(sinceDate, limitMonths);
        break;

      case 'month':
        if (!targetMonth) {
          throw new Error('Brak wymaganego parametru targetMonth dla synchronizacji miesięcznej');
        }
        
        console.log(`📅 Synchronizacja miesiąca: ${targetMonth}`);
        filesToProcess = await getFilesFromSpecificMonth(targetMonth);
        break;

      case 'full':
        console.log(`💾 Pełna synchronizacja - może to potrwać długo...`);
        // Dla pełnej synchronizacji pobierz wszystkie pliki z ostatnich 6 miesięcy
        filesToProcess = await getNewFilesFromDrive(null, 6);
        break;

      default:
        throw new Error(`Nieznany typ synchronizacji: ${syncType}`);
    }

    console.log(`📄 Znaleziono ${filesToProcess.length} plików do przetworzenia`);

    if (filesToProcess.length === 0) {
      await queries.completeSync(syncId, 0, 0, 0);
      return NextResponse.json({
        success: true,
        message: 'Brak nowych plików do synchronizacji',
        results
      });
    }

    // Przetwarzaj pliki
    for (const file of filesToProcess) {
      results.processed++;
      
      try {
        console.log(`⬇️ Pobieranie: ${file.fullPath}`);
        
        // Zapisz metadane pliku do cache
        await queries.upsertDriveFileCache(
          file.id,
          file.name,
          file.filePath,
          file.modifiedTime,
          file.size
        );
        
        // Pobierz i konwertuj plik (bez sprawdzania duplikatów - już sprawdzone w getNewFilesFromDrive)
        const fileBuffer = await downloadDocxFile(file.id);
        const parser = new DocxParser();
        const article = await parser.convertToArticle(fileBuffer, file.name, file.filePath);
        
        // Uzupełnij metadane artykułu
        article.imported_from = `google_drive_${syncType}`;
        article.drive_path = file.filePath;
        article.original_filename = file.name;
        article.status = 'draft';
        
        // Zapisz artykuł do bazy (bez sprawdzania duplikatów - już sprawdzone)
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
        
        // Oznacz plik jako przetworzony
        await queries.markDriveFileAsProcessed(file.id, true);
        
        console.log(`✅ Zaimportowano: ${article.title}`);
        results.imported++;
        
      } catch (error) {
        console.error(`❌ Błąd przetwarzania ${file.fullPath}:`, error.message);
        results.errors.push({
          file: file.fullPath,
          error: error.message
        });
        
        // Oznacz plik jako problematyczny w cache
        await queries.markDriveFileAsProcessed(file.id, false);
      }
    }

    // Zakończ synchronizację
    await queries.completeSync(
      syncId, 
      results.processed, 
      results.imported, 
      results.skipped
    );

    console.log(`✅ Synchronizacja zakończona!`);
    console.log(`📊 Statystyki: ${results.imported} nowych, ${results.skipped} pominiętych, ${results.errors.length} błędów`);

    return NextResponse.json({
      success: true,
      message: `Synchronizacja ${syncType} zakończona pomyślnie`,
      results
    });

  } catch (error) {
    console.error('❌ Błąd synchronizacji:', error.message);
    
    // Oznacz synchronizację jako nieudaną
    if (syncId) {
      await queries.completeSync(syncId, 0, 0, 0, error.message);
    }
    
    return NextResponse.json({
      success: false,
      error: `Błąd synchronizacji: ${error.message}`
    }, { status: 500 });
  }
} 