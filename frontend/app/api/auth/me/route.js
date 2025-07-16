import { NextResponse } from 'next/server';
const { verifyToken } = require('../../../../lib/auth-simple.js');

export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    const verification = await verifyToken(token);
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: verification.user
    });

  } catch (error) {
    console.error('Błąd API sprawdzania użytkownika:', error);
    return NextResponse.json(
      { error: 'Błąd serwera' },
      { status: 500 }
    );
  }
} 