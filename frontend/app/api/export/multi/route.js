import { NextResponse } from 'next/server';
import { queries } from '@/lib/database';

// Funkcja do konwersji polskich znaków na ASCII dla nazw plików
function sanitizeFilename(filename) {
  const polishChars = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  };
  
  return filename
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishChars[char] || char)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_');
}

// POST /api/export/multi - eksportuj wiele artykułów w formacie dla użytkownika
export async function POST(request) {
  try {
    const body = await request.json();
    const { articleIds } = body;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Brak artykułów do eksportu' },
        { status: 400 }
      );
    }

    // Pobierz wszystkie artykuły
    const articles = [];
    
    for (const articleId of articleIds) {
      const article = await queries.getArticleById(articleId);
      if (article) {
        articles.push(article);
      }
    }

    if (articles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nie znaleziono żadnych artykułów' },
        { status: 404 }
      );
    }

    // Przekształć artykuły do formatu eksportu
    const exportData = {
      articles: articles.map(article => ({
        articleId: article.article_id,
        title: article.title,
        titleHotnews: article.title_hotnews || '',
        titleSocial: article.title_social || '',
        titleSeo: article.title_seo || '',
        lead: article.lead || '',
        description: article.description || '',
        // wymuszenie zgodne ze specyfikacją
        author: 'red.',
        sources: ['polsatnews.pl'],
        categories: JSON.parse(article.categories || '["Ciekawostki"]'),
        tags: JSON.parse(article.tags || '[]'),
        imageFilename: article.image_filename || null
      }))
    };

    // Zwróć plik JSON do pobrania
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Generuj nazwę pliku
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `articles_export_${timestamp}_${articles.length}_items.json`;
    
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(filename)}"`
      }
    });

  } catch (error) {
    console.error('Błąd multi-eksportu:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera podczas eksportu' },
      { status: 500 }
    );
  }
} 