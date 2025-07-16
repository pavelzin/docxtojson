import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-drive';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Błąd autoryzacji:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd autoryzacji Google Drive' },
      { status: 500 }
    );
  }
} 