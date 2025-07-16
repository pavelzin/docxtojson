import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkDriveConnectionStatus } from '@/lib/google-drive';

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

// Funkcja do zapisywania odświeżonych tokenów
function saveRefreshedTokens(tokens) {
  const cookieStore = cookies();
  
  if (tokens.access_token) {
    cookieStore.set('google_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    });
  }
  
  if (tokens.refresh_token) {
    cookieStore.set('google_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 dni
    });
  }
}

export async function GET() {
  try {
    const tokens = getTokensFromCookies();
    
    if (!tokens) {
      return NextResponse.json({
        connected: false,
        error: 'Brak autoryzacji. Zaloguj się do Google Drive.'
      });
    }
    
    // Sprawdź status połączenia i ewentualnie odnów tokeny
    const status = await checkDriveConnectionStatus(tokens);
    
    // Jeśli tokeny zostały odświeżone, zapisz je
    if (status.connected && status.refreshed && status.tokens) {
      saveRefreshedTokens(status.tokens);
    }
    
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('Błąd sprawdzania statusu Google Drive:', error);
    return NextResponse.json({
      connected: false,
      error: 'Błąd sprawdzania połączenia z Google Drive'
    }, { status: 500 });
  }
} 