import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { setCredentials, findMonthFolderId, getArticleFolders, getImageFiles, getImageFilesRecursive } from '@/lib/google-drive';

function getTokensFromCookies() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('google_access_token')?.value;
  const refreshToken = cookieStore.get('google_refresh_token')?.value;
  if (!accessToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

export async function GET(request) {
  try {
    const tokens = getTokensFromCookies();
    if (!tokens) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji Google Drive' }, { status: 401 });
    }
    setCredentials(tokens);

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    if (!month) return NextResponse.json({ success: false, error: 'Podaj ?month=' }, { status: 400 });

    const monthId = await findMonthFolderId(month);
    if (!monthId) return NextResponse.json({ success: false, error: `Nie znaleziono miesiąca: ${month}` }, { status: 404 });

    const articleFolders = await getArticleFolders(monthId);
    const summary = [];

    for (const folder of articleFolders) {
      const top = await getImageFiles(folder.id);
      const deep = await getImageFilesRecursive(folder.id);
      const largest = deep && deep.length ? deep.reduce((a, b) => (b.size > a.size ? b : a), deep[0]) : null;
      summary.push({
        articleFolderId: folder.id,
        articleFolderName: folder.name,
        imagesTopCount: top.length,
        imagesDeepCount: deep.length,
        largestImage: largest ? { name: largest.name, size: largest.size } : null
      });
    }

    return NextResponse.json({ success: true, month, monthId, articleCount: articleFolders.length, summary });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd skanowania miesiąca' }, { status: 500 });
  }
}




