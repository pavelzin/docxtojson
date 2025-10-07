import { NextResponse } from 'next/server';
import { queries } from '@/lib/database';

// Wyłącz cache dla tego endpointa
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await queries.getSyncStats(5);
    const lastSync = await queries.getLastSuccessfulSync();
    
    return NextResponse.json({
      success: true,
      stats,
      lastSync
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Błąd pobierania statystyk synchronizacji:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera'
    }, { status: 500 });
  }
} 