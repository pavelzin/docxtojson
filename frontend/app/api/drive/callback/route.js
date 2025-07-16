import { NextResponse } from 'next/server';
import { getTokenFromCode } from '@/lib/google-drive';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/import?error=access_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/import?error=missing_code`);
    }

    // Pobierz token z kodu autoryzacji
    const tokens = await getTokenFromCode(code);

    // Zapisz tokeny w cookies (lub session store)
    const cookieStore = cookies();
    cookieStore.set('google_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    });

    if (tokens.refresh_token) {
      cookieStore.set('google_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 dni
      });
    }

    // Przekieruj z powrotem do strony importu
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/import?success=1`);

  } catch (error) {
    console.error('Błąd callback:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/import?error=callback_failed`);
  }
} 