import { NextResponse } from 'next/server';
import { queries } from '@/lib/database';

export async function GET() {
  try {
    const stats = await queries.getSyncStats(5);
    const lastSync = await queries.getLastSuccessfulSync();
    
    return NextResponse.json({
      success: true,
      stats,
      lastSync
    });
  } catch (error) {
    console.error('Błąd pobierania statystyk synchronizacji:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera'
    }, { status: 500 });
  }
} 