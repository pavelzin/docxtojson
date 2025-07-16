import { NextResponse } from 'next/server';
const { loginUser } = require('../../../../lib/auth-simple.js');

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Nazwa użytkownika i hasło są wymagane' },
        { status: 400 }
      );
    }

    const result = await loginUser(username, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Ustawienie cookie z tokenem
    const response = NextResponse.json({
      success: true,
      user: result.user
    });

    response.cookies.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 dni
    });

    return response;

  } catch (error) {
    console.error('Błąd API logowania:', error);
    return NextResponse.json(
      { error: 'Błąd serwera' },
      { status: 500 }
    );
  }
} 