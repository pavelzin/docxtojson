import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import path from 'path';
import { promises as fs } from 'fs';
import { 
  setCredentials, 
  getNewFilesFromDrive,
  getFilesFromSpecificMonth,
  downloadDocxFile,
  findBestArticleImage,
  findBestArticleImageDeep,
  findMonthFolderId,
  findArticleFolderId,
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
  let syncId = null;
  
  try {
    // Upewnij się, że baza (migracje) jest gotowa
    await initializeDatabase();
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
        await queries.addSyncLog(syncId, 'info', `🔄 Synchronizacja inkrementalna (ostatnie ${limitMonths} miesiące)`);
        
        // Pobierz datę ostatniej udanej synchronizacji
        const lastSync = await queries.getLastSuccessfulSync('incremental');
        const sinceDate = lastSync ? lastSync.completed_at : null;
        
        if (sinceDate) {
          console.log(`📅 Szukam plików nowszych niż: ${sinceDate}`);
          await queries.addSyncLog(syncId, 'info', `📅 Szukam plików nowszych niż: ${sinceDate}`);
        } else {
          console.log(`📅 Pierwsza synchronizacja - pobieram ostatnie ${limitMonths} miesiące`);
          await queries.addSyncLog(syncId, 'info', `📅 Pierwsza synchronizacja - pobieram ostatnie ${limitMonths} miesiące`);
        }
        
        filesToProcess = await getNewFilesFromDrive(sinceDate, limitMonths);
        break;

      case 'month':
        if (!targetMonth) {
          throw new Error('Brak wymaganego parametru targetMonth dla synchronizacji miesięcznej');
        }
        
        console.log(`📅 Synchronizacja miesiąca: ${targetMonth}`);
        await queries.addSyncLog(syncId, 'info', `📅 Synchronizacja miesiąca: ${targetMonth}`);
        filesToProcess = await getFilesFromSpecificMonth(targetMonth);
        break;

      case 'full':
        console.log(`💾 Pełna synchronizacja - może to potrwać długo...`);
        await queries.addSyncLog(syncId, 'info', `💾 Pełna synchronizacja - może to potrwać długo...`);
        // Dla pełnej synchronizacji pobierz wszystkie pliki z ostatnich 6 miesięcy
        filesToProcess = await getNewFilesFromDrive(null, 6);
        break;

      default:
        throw new Error(`Nieznany typ synchronizacji: ${syncType}`);
    }

    console.log(`📄 Znaleziono ${filesToProcess.length} plików do przetworzenia`);
    await queries.addSyncLog(syncId, 'info', `📄 Znaleziono ${filesToProcess.length} plików do przetworzenia`);

    if (filesToProcess.length === 0) {
      await queries.addSyncLog(syncId, 'info', '✅ Brak nowych plików do synchronizacji');
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
        await queries.addSyncLog(syncId, 'info', `⬇️ Pobieranie: ${file.fullPath}`, file.fullPath);
        
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

        // Spróbuj znaleźć zdjęcie dla artykułu – używamy folderu artykułu, jeśli mamy go w metadanych
        {
          let articleFolderId = file.articleFolderId;
          if (!articleFolderId && file.filePath) {
            try {
              const [monthName, ...rest] = file.filePath.split('/');
              const articleName = rest.join('/');
              const monthId = await findMonthFolderId(monthName);
              if (monthId) {
                articleFolderId = await findArticleFolderId(monthId, articleName);
              }
            } catch {}
          }

          if (articleFolderId) {
            let bestImage = await findBestArticleImage(articleFolderId);
            if (!bestImage) {
              bestImage = await findBestArticleImageDeep(articleFolderId);
            }
            if (bestImage) {
              article.imageFilename = bestImage.name;
              article.imageModifiedTime = bestImage.modifiedTime;
              console.log(`🖼️ [smart-sync] Found image for ${file.fullPath}: ${bestImage.name} (${bestImage.size} B)`);
              // Pobierz obraz i zapisz lokalnie
              try {
                const media = await drive.files.get({ fileId: bestImage.id, alt: 'media' }, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(media.data);
                const rel = String(file.filePath || article.drive_path || '').split('/').filter(Boolean);
                const dir = path.join(process.cwd(), 'public', 'images', ...rel);
                await fs.mkdir(dir, { recursive: true });
                
                // USUŃ STARE OBRAZKI z tego katalogu (cache busting)
                try {
                  const files = await fs.readdir(dir);
                  for (const oldFile of files) {
                    if (oldFile !== bestImage.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(oldFile)) {
                      await fs.unlink(path.join(dir, oldFile));
                      console.log(`🗑️ Usunięto stary obrazek: ${oldFile}`);
                    }
                  }
                } catch (e) {
                  console.warn(`[smart-sync] Nie udało się usunąć starych obrazków: ${e.message}`);
                }
                
                await fs.writeFile(path.join(dir, bestImage.name), buffer);
                console.log(`💾 Zapisano nowy obrazek: ${bestImage.name}`);
              } catch (e) {
                console.warn(`[smart-sync] Nie udało się zapisać obrazu lokalnie: ${e.message}`);
              }
            } else {
              console.log(`🖼️ [smart-sync] No image found for ${file.fullPath}`);
            }
          } else {
            console.log(`🖼️ [smart-sync] Could not resolve articleFolderId for ${file.fullPath}`);
          }
        }
        
        // Uzupełnij metadane artykułu
        article.imported_from = `google_drive_${syncType}`;
        article.drive_path = file.filePath;
        article.original_filename = file.name;
        article.status = 'draft';
        
        // Jeśli artykuł już istnieje (po tytule), nie wstawiaj duplikatu, ale uzupełnij image_filename jeśli brak
        const existing = await queries.getArticleByTitle(article.title);
        if (existing) {
          // Sprawdź czy obrazek wymaga aktualizacji
          const needsImageUpdate = article.imageFilename && (
            existing.image_filename !== article.imageFilename || // Inna nazwa
            !existing.image_modified_time || // Brak zapisanej daty
            (article.imageModifiedTime && new Date(article.imageModifiedTime) > new Date(existing.image_modified_time)) // Nowszy plik
          );
          
          if (needsImageUpdate) {
            await queries.setArticleImageFilename(existing.article_id, article.imageFilename, article.imageModifiedTime);
            if (existing.image_filename !== article.imageFilename) {
              console.log(`🖼️ Zaktualizowano obraz dla: ${article.title} (${existing.image_filename} → ${article.imageFilename})`);
              await queries.addSyncLog(syncId, 'success', `🖼️ Zaktualizowano obraz: ${existing.image_filename} → ${article.imageFilename}`, file.fullPath);
            } else {
              console.log(`🖼️ Zaktualizowano obraz dla: ${article.title} (ten sam plik, nowsza wersja)`);
              await queries.addSyncLog(syncId, 'success', `🖼️ Zaktualizowano obraz (nowsza wersja): ${article.imageFilename}`, file.fullPath);
            }
          } else if (!existing.image_filename && article.imageFilename) {
            await queries.setArticleImageFilename(existing.article_id, article.imageFilename, article.imageModifiedTime);
            console.log(`🖼️ Uzupełniono obraz dla: ${article.title}`);
            await queries.addSyncLog(syncId, 'info', `🖼️ Uzupełniono obraz dla: ${article.title}`, file.fullPath);
          } else {
            await queries.addSyncLog(syncId, 'info', `⏭️ Pominięto (już istnieje): ${article.title}`, file.fullPath);
          }
          results.skipped++;
        } else {
          // Jeśli nie znaleziono po tytule – spróbuj po ścieżce i oryginalnej nazwie pliku
          const existingByPath = await queries.getArticleByPath(article.drive_path, article.original_filename);
          if (existingByPath) {
            // Sprawdź czy obrazek wymaga aktualizacji
            const needsImageUpdate = article.imageFilename && (
              existingByPath.image_filename !== article.imageFilename || // Inna nazwa
              !existingByPath.image_modified_time || // Brak zapisanej daty
              (article.imageModifiedTime && new Date(article.imageModifiedTime) > new Date(existingByPath.image_modified_time)) // Nowszy plik
            );
            
            if (needsImageUpdate) {
              await queries.setArticleImageFilename(existingByPath.article_id, article.imageFilename, article.imageModifiedTime);
              if (existingByPath.image_filename !== article.imageFilename) {
                console.log(`🖼️ Zaktualizowano obraz (po ścieżce) dla: ${existingByPath.title} (${existingByPath.image_filename} → ${article.imageFilename})`);
                await queries.addSyncLog(syncId, 'success', `🖼️ Zaktualizowano obraz: ${existingByPath.image_filename} → ${article.imageFilename}`, file.fullPath);
              } else {
                console.log(`🖼️ Zaktualizowano obraz (po ścieżce) dla: ${existingByPath.title} (ten sam plik, nowsza wersja)`);
                await queries.addSyncLog(syncId, 'success', `🖼️ Zaktualizowano obraz (nowsza wersja): ${article.imageFilename}`, file.fullPath);
              }
            } else if (!existingByPath.image_filename && article.imageFilename) {
              await queries.setArticleImageFilename(existingByPath.article_id, article.imageFilename, article.imageModifiedTime);
              console.log(`🖼️ Uzupełniono obraz (po ścieżce) dla: ${existingByPath.title}`);
              await queries.addSyncLog(syncId, 'info', `🖼️ Uzupełniono obraz (po ścieżce) dla: ${existingByPath.title}`, file.fullPath);
            } else {
              await queries.addSyncLog(syncId, 'info', `⏭️ Pominięto (już istnieje po ścieżce): ${existingByPath.title}`, file.fullPath);
            }
            results.skipped++;
            continue;
          }

          // Zapisz artykuł do bazy
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

          // Jeśli znaleziono zdjęcie – zapisz je do bazy
          if (article.imageFilename) {
            await queries.setArticleImageFilename(article.articleId, article.imageFilename, article.imageModifiedTime);
          }

          // Oznacz plik jako przetworzony
          await queries.markDriveFileAsProcessed(file.id, true);

          console.log(`✅ Zaimportowano: ${article.title}`);
          await queries.addSyncLog(syncId, 'success', `✅ Zaimportowano: ${article.title}`, file.fullPath);
          results.imported++;
        }
        
      } catch (error) {
        console.error(`❌ Błąd przetwarzania ${file.fullPath}:`, error.message);
        await queries.addSyncLog(syncId, 'error', `❌ Błąd: ${error.message}`, file.fullPath);
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
    await queries.addSyncLog(syncId, 'success', `✅ Synchronizacja zakończona! Statystyki: ${results.imported} nowych, ${results.skipped} pominiętych, ${results.errors.length} błędów`);

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