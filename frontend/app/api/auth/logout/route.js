import { NextResponse } from 'next/server';
import { logoutUser } from '../../../../lib/auth.js';

export async function POST(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (token) {
      await logoutUser(token);
    }

    const response = NextResponse.json({ success: true });
    
    // Usunięcie cookie
    response.cookies.delete('auth_token');

    return response;

  } catch (error) {
    console.error('Błąd API wylogowania:', error);
    return NextResponse.json(
      { error: 'Błąd serwera' },
      { status: 500 }
    );
  }
} 