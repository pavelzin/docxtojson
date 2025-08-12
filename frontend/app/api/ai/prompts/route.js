import { NextResponse } from 'next/server';
import { initializeDatabase, prompts, helpers } from '@/lib/database';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initializeDatabase();
    await helpers.ensureDefaultPrompts();
    initialized = true;
  }
}

export async function GET() {
  try {
    await ensureInit();
    const all = await prompts.getAll();
    return NextResponse.json({ success: true, prompts: all });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Błąd pobierania promptów' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await ensureInit();
    const body = await request.json();
    const { prompts: newPrompts } = body || {};
    if (!newPrompts || typeof newPrompts !== 'object') {
      return NextResponse.json({ success: false, error: 'Brak danych promptów' }, { status: 400 });
    }
    await prompts.upsertMany(newPrompts);
    const all = await prompts.getAll();
    return NextResponse.json({ success: true, prompts: all });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Błąd zapisu promptów' }, { status: 500 });
  }
}


