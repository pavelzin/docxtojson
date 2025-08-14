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

// GET /api/export/[id] - eksportuj artykuł jako JSON
export async function GET(request, { params }) {
  try {
    const articleId = params.id;
    
    const article = await queries.getArticleById(articleId);
    
    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Artykuł nie znaleziony' },
        { status: 404 }
      );
    }
    
    const exportData = {
      id: article.article_id,
      title: article.title,
      titleHotnews: article.title_hotnews,
      titleSocial: article.title_social,
      titleSeo: article.title_seo,
      lead: article.lead,
      description: article.description,
      author: article.author,
      sources: JSON.parse(article.sources || '[]'),
      categories: JSON.parse(article.categories || '[]'),
      tags: JSON.parse(article.tags || '[]'),
      imageFilename: article.image_filename || null,
      status: article.status,
      dates: {
        created: article.created_at,
        updated: article.updated_at,
        imported: article.imported_at
      }
    };
    
    // Zwróć plik JSON do pobrania
    const jsonString = JSON.stringify(exportData, null, 2);
    
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(article.title)}.json"`
      }
    });
    
  } catch (error) {
    console.error('Błąd eksportu:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera podczas eksportu' },
      { status: 500 }
    );
  }
} 