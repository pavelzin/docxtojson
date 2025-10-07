import { NextResponse } from 'next/server';
import { queries } from '@/lib/database';

// Wyłącz cache dla tego endpointa
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    let logs;
    let syncList;

    if (syncId) {
      // Pobierz logi dla konkretnej synchronizacji
      logs = await queries.getSyncLogs(parseInt(syncId, 10), limit);
      
      // Pobierz też info o tej synchronizacji
      const syncInfo = await queries.getSyncStats(1);
      const selectedSync = syncInfo.find(s => s.id === parseInt(syncId, 10));
      
      return NextResponse.json({
        success: true,
        logs: logs.reverse(), // Odwróć żeby najstarsze były na górze
        syncInfo: selectedSync || null
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      // Pobierz listę wszystkich synchronizacji z liczbą logów
      syncList = await queries.getSyncListWithLogs(20);
      
      return NextResponse.json({
        success: true,
        syncList
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  } catch (error) {
    console.error('Błąd pobierania logów synchronizacji:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd serwera'
    }, { status: 500 });
  }
}

