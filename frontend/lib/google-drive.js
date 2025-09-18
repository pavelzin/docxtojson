import { google } from 'googleapis';

// Konfiguracja OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes potrzebne do odczytu plików z Drive
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly'
  // drive.file usunięte - aplikacja tylko czyta, nie tworzy plików
];

// ID głównego folderu na Google Drive (z linka który podałeś)
const MAIN_FOLDER_ID = '1X_b_oa2GqkW5gtLx6SMLkU-a74db1eWU';

// Inicjalizacja Drive API
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Funkcja do generowania URL autoryzacji
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

// Funkcja do uzyskania tokenu z kodu autoryzacji
export async function getTokenFromCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
  } catch (error) {
    console.error('Błąd pobierania tokenu:', error);
    throw error;
  }
}

// Funkcja do ustawienia tokenów
export function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
}

// Sprawdź czy tokeny są prawidłowe i odnów je jeśli potrzeba
export async function validateAndRefreshTokens(tokens) {
  try {
    oauth2Client.setCredentials(tokens);
    
    // Sprawdź czy access token jest ważny poprzez testowe zapytanie
    const testResponse = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });
    
    // Jeśli zapytanie się powiodło, tokeny są OK
    return {
      isValid: true,
      tokens: oauth2Client.credentials
    };
    
  } catch (error) {
    console.log('🔄 Token wygasł, próbuję odnowić...');
    
    // Spróbuj odnowić token używając refresh_token
    if (tokens.refresh_token) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        
        console.log('✅ Token odnowiony pomyślnie');
        return {
          isValid: true,
          tokens: credentials,
          refreshed: true
        };
        
      } catch (refreshError) {
        console.error('❌ Błąd odnawiania tokenu:', refreshError);
        return {
          isValid: false,
          error: 'Nie można odnowić tokenu. Wymagana ponowna autoryzacja.'
        };
      }
    } else {
      return {
        isValid: false,
        error: 'Brak refresh_token. Wymagana ponowna autoryzacja.'
      };
    }
  }
}

// Sprawdź status połączenia z Google Drive
export async function checkDriveConnectionStatus(tokens) {
  if (!tokens || !tokens.access_token) {
    return {
      connected: false,
      error: 'Brak tokenów autoryzacji'
    };
  }
  
  try {
    const validation = await validateAndRefreshTokens(tokens);
    
    if (validation.isValid) {
      return {
        connected: true,
        tokens: validation.tokens,
        refreshed: validation.refreshed || false
      };
    } else {
      return {
        connected: false,
        error: validation.error
      };
    }
    
  } catch (error) {
    return {
      connected: false,
      error: 'Błąd sprawdzania połączenia z Google Drive'
    };
  }
}

// Funkcja do pobierania miesięcy (głównych folderów)
export async function getMonthFolders() {
  try {
    const response = await drive.files.list({
      q: `'${MAIN_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'name'
    });

    return response.data.files.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'folder',
      articleCount: 0 // Będzie obliczone dynamicznie
    }));
  } catch (error) {
    console.error('Błąd pobierania miesięcy:', error);
    throw error;
  }
}

// Funkcja do pobierania artykułów w danym miesiącu
export async function getArticleFolders(monthFolderId) {
  try {
    const response = await drive.files.list({
      q: `'${monthFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'name'
    });

    const articles = [];
    
    for (const folder of response.data.files) {
      // Policz pliki w folderze artykułu
      const fileCount = await countFilesInFolder(folder.id);
      
      articles.push({
        id: folder.id,
        name: folder.name,
        type: 'folder',
        fileCount
      });
    }

    return articles;
  } catch (error) {
    console.error('Błąd pobierania artykułów:', error);
    throw error;
  }
}

// Funkcja do pobierania plików DOCX w folderze artykułu
export async function getDocxFiles(articleFolderId) {
  try {
    const response = await drive.files.list({
      q: `'${articleFolderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or name contains '.docx') and trashed=false`,
      fields: 'files(id, name, size, modifiedTime)',
      orderBy: 'name'
    });

    return response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      type: 'file',
      size: parseInt(file.size) || 0,
      modifiedTime: file.modifiedTime,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }));
  } catch (error) {
    console.error('Błąd pobierania plików DOCX:', error);
    throw error;
  }
}

// Funkcja pomocnicza do liczenia plików w folderze
async function countFilesInFolder(folderId) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id)'
    });

    return response.data.files.length;
  } catch (error) {
    console.error('Błąd liczenia plików:', error);
    return 0;
  }
}

// Funkcja do pobierania zawartości pliku DOCX
export async function downloadDocxFile(fileId) {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Błąd pobierania pliku:', error);
    throw error;
  }
}

// Funkcja do znajdowania ID folderu miesiąca po nazwie
export async function findMonthFolderId(monthName) {
  try {
    const months = await getMonthFolders();
    const month = months.find(m => m.name === monthName);
    return month ? month.id : null;
  } catch (error) {
    console.error('Błąd znajdowania folderu miesiąca:', error);
    throw error;
  }
}

// Funkcja do znajdowania ID folderu artykułu po nazwie
export async function findArticleFolderId(monthFolderId, articleName) {
  try {
    const articles = await getArticleFolders(monthFolderId);
    const article = articles.find(a => a.name === articleName);
    return article ? article.id : null;
  } catch (error) {
    console.error('Błąd znajdowania folderu artykułu:', error);
    throw error;
  }
}

// Uniwersalna funkcja do pobierania folderów lub plików
export async function listFolders(drive, parentFolderId, foldersOnly = true) {
  try {
    let query = `'${parentFolderId}' in parents and trashed=false`;
    
    if (foldersOnly) {
      query += ` and mimeType='application/vnd.google-apps.folder'`;
    } else {
      // Pobierz pliki (nie foldery)
      query += ` and mimeType!='application/vnd.google-apps.folder'`;
    }
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'name'
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Błąd pobierania elementów z Drive:', error);
    throw error;
  }
}

// Funkcja do pobierania tokenów z cookies
function getTokensFromCookies(request) {
  const cookies = request.headers.get('cookie');
  if (!cookies) return null;
  
  const cookieMap = {};
  cookies.split('; ').forEach(cookie => {
    const [key, value] = cookie.split('=');
    cookieMap[key] = value;
  });
  
  const accessToken = cookieMap['google_access_token'];
  const refreshToken = cookieMap['google_refresh_token'];
  
  if (!accessToken) return null;
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
}

// Funkcja do uzyskania autoryzowanego klienta Drive
export async function getDriveClient(request) {
  try {
    const tokens = getTokensFromCookies(request);
    if (!tokens) {
      return null;
    }
    
    oauth2Client.setCredentials(tokens);
    return google.drive({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    console.error('Błąd autoryzacji Drive:', error);
    return null;
  }
}

// Alias dla downloadDocxFile
export const downloadFile = downloadDocxFile;

// === INTELIGENTNA SYNCHRONIZACJA ===

// Pobierz tylko najnowsze miesiące (sortowane według daty utworzenia/modyfikacji)
export async function getRecentMonthFolders(limitMonths = 3) {
  try {
    const response = await drive.files.list({
      q: `'${MAIN_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, modifiedTime, createdTime)',
      orderBy: 'createdTime desc' // Najnowsze miesiące na górze
    });

    // Ograniczymy do ostatnich N miesięcy
    const recentMonths = response.data.files.slice(0, limitMonths);
    
    return recentMonths.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'folder',
      modifiedTime: folder.modifiedTime,
      createdTime: folder.createdTime
    }));
  } catch (error) {
    console.error('Błąd pobierania najnowszych miesięcy:', error);
    throw error;
  }
}

// Pobierz wszystkie pliki DOCX z danego miesiąca z pełnymi metadanymi
export async function getAllDocxFilesInMonth(monthFolderId, monthName) {
  try {
    const allFiles = [];
    
    // 1. Pobierz wszystkie foldery artykułów w miesiącu
    const articleFolders = await getArticleFolders(monthFolderId);
    
    // 2. Dla każdego folderu artykułu, pobierz pliki DOCX
    for (const articleFolder of articleFolders) {
      const docxFiles = await getDocxFiles(articleFolder.id);
      
      // Dodaj ścieżkę do każdego pliku
      for (const file of docxFiles) {
        allFiles.push({
          ...file,
          articleFolderName: articleFolder.name,
          articleFolderId: articleFolder.id,
          filePath: `${monthName}/${articleFolder.name}`,
          fullPath: `${monthName}/${articleFolder.name}/${file.name}`
        });
      }
    }
    
    return allFiles;
  } catch (error) {
    console.error('Błąd pobierania plików z miesiąca:', error);
    throw error;
  }
}

// Sprawdź które pliki są nowe od ostatniej synchronizacji
export async function getNewFilesFromDrive(sinceDate = null, limitMonths = 2) {
  try {
    const newFiles = [];
    
    // Pobierz najnowsze miesiące
    const recentMonths = await getRecentMonthFolders(limitMonths);
    
    for (const month of recentMonths) {
      console.log(`🔍 Sprawdzanie miesiąca: ${month.name}`);
      
      // Pobierz wszystkie pliki z tego miesiąca
      const monthFiles = await getAllDocxFilesInMonth(month.id, month.name);
      
      // Filtruj tylko pliki nowsze niż data odniesienia (jeśli podana)
      const dateFilteredFiles = sinceDate 
        ? monthFiles.filter(file => new Date(file.modifiedTime) > new Date(sinceDate))
        : monthFiles;
      
      console.log(`📄 Znaleziono ${dateFilteredFiles.length} plików nowszych niż ${sinceDate || 'początek'} w ${month.name}`);
      
      // Sprawdź w bazie danych które z tych plików już istnieją
      const trulyNewFiles = [];
      for (const file of dateFilteredFiles) {
        try {
          // Importuj moduł bazy danych dynamicznie (aby uniknąć cyklicznych zależności)
          const { queries } = await import('../lib/database.js');
          
          // Sprawdź czy artykuł już istnieje na podstawie ścieżki Drive i nazwy pliku
          const existing = await queries.getArticleByPath(file.filePath, file.name);
          
          if (!existing) {
            trulyNewFiles.push(file);
          } else {
            console.log(`⏭️ Plik już istnieje w bazie: ${file.fullPath}`);
          }
        } catch (dbError) {
          console.warn(`⚠️ Błąd sprawdzania bazy dla ${file.fullPath}, dodaję do przetworzenia:`, dbError.message);
          // W przypadku błędu bazy danych, dodaj plik do przetworzenia (bezpieczniejsze)
          trulyNewFiles.push(file);
        }
      }
      
      newFiles.push(...trulyNewFiles);
      console.log(`✅ Rzeczywiście nowych plików w ${month.name}: ${trulyNewFiles.length}`);
    }
    
    // Sortuj według daty modyfikacji (najnowsze pierwsze)
    newFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    
    console.log(`🎯 Łącznie znaleziono ${newFiles.length} nowych plików do zaimportowania`);
    return newFiles;
  } catch (error) {
    console.error('Błąd pobierania nowych plików:', error);
    throw error;
  }
}

// Pobierz pliki tylko z konkretnego miesiąca (dla częściowej synchronizacji)
export async function getFilesFromSpecificMonth(monthName) {
  try {
    // Znajdź folder miesiąca
    const months = await getMonthFolders();
    const targetMonth = months.find(m => m.name === monthName);
    
    if (!targetMonth) {
      throw new Error(`Nie znaleziono miesiąca: ${monthName}`);
    }
    
    // Pobierz wszystkie pliki z tego miesiąca
    return await getAllDocxFilesInMonth(targetMonth.id, monthName);
  } catch (error) {
    console.error('Błąd pobierania plików z konkretnego miesiąca:', error);
    throw error;
  }
}

// Funkcja do pobierania plików graficznych w folderze artykułu
export async function getImageFiles(articleFolderId) {
  try {
    // Pobierz tylko obrazy
    const response = await drive.files.list({
      q: `'${articleFolderId}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'files(id, name, size, mimeType, modifiedTime)',
      orderBy: 'name'
    });

    return response.data.files;
  } catch (error) {
    console.error('Błąd pobierania plików graficznych:', error);
    throw error;
  }
}

export { oauth2Client, drive }; 