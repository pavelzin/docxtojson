import { NextResponse } from 'next/server';
import { queries, helpers, initializeDatabase } from '@/lib/database';

// Inicjalizacja bazy przy pierwszym żądaniu
let isDbInitialized = false;
async function ensureDbInitialized() {
  if (!isDbInitialized) {
    await initializeDatabase();
    isDbInitialized = true;
  }
}

// GET /api/articles - pobierz wszystkie artykuły
export async function GET(request) {
  try {
    // Upewnij się że baza jest zainicjalizowana
    await ensureDbInitialized();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    let articles = await queries.getAllArticles();
    
    // Parsuj JSON fields z zabezpieczeniem przed błędami
    articles = articles.map(article => {
      const safeParse = (jsonString, fallback = []) => {
        try {
          const parsed = JSON.parse(jsonString || '[]');
          return Array.isArray(parsed) ? parsed : fallback;
        } catch (e) {
          console.warn(`Błąd parsowania JSON dla artykułu ${article.article_id}:`, e.message);
          return fallback;
        }
      };

      return {
        ...article,
        sources: safeParse(article.sources),
        categories: safeParse(article.categories),
        tags: safeParse(article.tags),
        ai_fields: article.ai_fields ? article.ai_fields.split(',') : []
      };
    });
    
    // Filtruj po statusie
    if (status && status !== 'all') {
      articles = articles.filter(article => article.status === status);
    }
    
    // Filtruj po tekście wyszukiwania
    if (search) {
      const searchLower = search.toLowerCase();
      articles = articles.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.lead?.toLowerCase().includes(searchLower) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      articles,
      total: articles.length 
    });
    
  } catch (error) {
    console.error('Błąd pobierania artykułów:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera' },
      { status: 500 }
    );
  }
}

// POST /api/articles - importuj artykuły z parsera
export async function POST(request) {
  try {
    const { articles } = await request.json();
    
    if (!articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe dane' },
        { status: 400 }
      );
    }
    
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    for (const article of articles) {
      try {
        await helpers.importArticleFromParser(article);
        importedCount++;
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          skippedCount++;
        } else {
          errors.push({
            articleId: article.articleId,
            error: error.message
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      errors
    });
    
  } catch (error) {
    console.error('Błąd importu artykułów:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera' },
      { status: 500 }
    );
  }
} 