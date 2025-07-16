import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  setCredentials, 
  getMonthFolders, 
  getArticleFolders, 
  getDocxFiles,
  findMonthFolderId,
  findArticleFolderId
} from '@/lib/google-drive';

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

export async function GET(request) {
  try {
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

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    const pathParts = path ? path.split('/').filter(Boolean) : [];

    let result = {};

    if (pathParts.length === 0) {
      // Główny katalog - pokaż miesiące
      const months = await getMonthFolders();
      result = {
        success: true,
        months: months,
        level: 'months'
      };
      
    } else if (pathParts.length === 1) {
      // W miesiącu - pokaż artykuły
      const monthName = pathParts[0];
      const monthFolderId = await findMonthFolderId(monthName);
      
      if (!monthFolderId) {
        return NextResponse.json(
          { success: false, error: `Nie znaleziono miesiąca: ${monthName}` },
          { status: 404 }
        );
      }

      const articles = await getArticleFolders(monthFolderId);
      result = {
        success: true,
        articles: articles,
        level: 'articles',
        monthName: monthName
      };
      
    } else if (pathParts.length === 2) {
      // W artykule - pokaż pliki DOCX
      const monthName = pathParts[0];
      const articleName = pathParts[1];
      
      const monthFolderId = await findMonthFolderId(monthName);
      if (!monthFolderId) {
        return NextResponse.json(
          { success: false, error: `Nie znaleziono miesiąca: ${monthName}` },
          { status: 404 }
        );
      }

      const articleFolderId = await findArticleFolderId(monthFolderId, articleName);
      if (!articleFolderId) {
        return NextResponse.json(
          { success: false, error: `Nie znaleziono artykułu: ${articleName}` },
          { status: 404 }
        );
      }

      const files = await getDocxFiles(articleFolderId);
      result = {
        success: true,
        files: files,
        level: 'files',
        monthName: monthName,
        articleName: articleName
      };
      
    } else {
      return NextResponse.json(
        { success: false, error: 'Zbyt głęboka ścieżka' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Błąd przeglądania Drive:', error);
    
    // Sprawdź czy to błąd autoryzacji
    if (error.code === 401 || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Sesja wygasła. Zaloguj się ponownie.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Błąd połączenia z Google Drive' },
      { status: 500 }
    );
  }
} 