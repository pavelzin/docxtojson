import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  setCredentials,
  findMonthFolderId,
  findArticleFolderId,
  getImageFiles,
  getImageFilesRecursive
} from '@/lib/google-drive';

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
    const path = searchParams.get('path');
    if (!path) {
      return NextResponse.json({ success: false, error: 'Podaj ?path=MONTH/ARTICLE' }, { status: 400 });
    }

    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ success: false, error: 'Ścieżka musi mieć format MIESIĄC/NAZWA_ARTYKUŁU' }, { status: 400 });
    }
    const monthName = parts[0];
    const articleName = parts.slice(1).join('/');

    const monthId = await findMonthFolderId(monthName);
    if (!monthId) {
      return NextResponse.json({ success: false, error: `Nie znaleziono miesiąca: ${monthName}` }, { status: 404 });
    }
    const articleFolderId = await findArticleFolderId(monthId, articleName);
    if (!articleFolderId) {
      return NextResponse.json({ success: false, error: `Nie znaleziono artykułu: ${articleName}` }, { status: 404 });
    }

    const imagesTop = await getImageFiles(articleFolderId);
    const imagesDeep = await getImageFilesRecursive(articleFolderId);

    const pickLargest = (arr) => arr && arr.length ? arr.reduce((a, b) => (b.size > a.size ? b : a), arr[0]) : null;
    const bestTop = pickLargest(imagesTop);
    const bestDeep = pickLargest(imagesDeep);

    return NextResponse.json({
      success: true,
      input: { path, monthName, articleName, articleFolderId },
      counts: { topLevel: imagesTop.length, deep: imagesDeep.length },
      bestTop,
      bestDeep,
      imagesTop,
      imagesDeep
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Błąd debugowania obrazów' }, { status: 500 });
  }
}






