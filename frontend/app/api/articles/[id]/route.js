import { NextResponse } from 'next/server';
import { queries, helpers } from '@/lib/database';

// GET /api/articles/[id] - pobierz pojedynczy artykuł
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
    
    // Pobierz pola AI
    const aiFields = await queries.getAIFieldsForArticle(articleId);
    
    // Parsuj JSON fields
    const parsedArticle = {
      ...article,
      sources: JSON.parse(article.sources || '[]'),
      categories: JSON.parse(article.categories || '[]'),
      tags: JSON.parse(article.tags || '[]'),
      aiFields: aiFields.reduce((acc, field) => {
        acc[field.field_name] = {
          isAI: field.is_ai_generated,
          confidence: field.ai_confidence,
          generationDate: field.generation_date
        };
        return acc;
      }, {})
    };
    
    return NextResponse.json({
      success: true,
      article: parsedArticle
    });
    
  } catch (error) {
    console.error('Błąd pobierania artykułu:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera' },
      { status: 500 }
    );
  }
}

// PUT /api/articles/[id] - aktualizuj artykuł
export async function PUT(request, { params }) {
  try {
    const articleId = params.id;
    const updateData = await request.json();
    
    // Pobierz obecny artykuł
    const currentArticle = await queries.getArticleById(articleId);
    
    if (!currentArticle) {
      return NextResponse.json(
        { success: false, error: 'Artykuł nie znaleziony' },
        { status: 404 }
      );
    }
    
    // Przygotuj dane do aktualizacji
    const {
      title, titleHotnews, titleSocial, titleSeo,
      lead, description, author, sources, categories, tags, status
    } = updateData;
    
    // Zapisz historię zmian dla zmienionych pól
    const fieldsToCheck = {
      title, title_hotnews: titleHotnews, title_social: titleSocial, 
      title_seo: titleSeo, lead, description, author, 
      sources: JSON.stringify(sources), 
      categories: JSON.stringify(categories),
      tags: JSON.stringify(tags),
      status
    };
    
    const aiFields = new Set(['title_hotnews', 'title_social', 'title_seo', 'tags']);
    for (const [fieldName, newValue] of Object.entries(fieldsToCheck)) {
      const oldValue = currentArticle[fieldName];
      if (oldValue !== newValue) {
        if (aiFields.has(fieldName)) {
          // Pole generowane przez AI – zachowaj status AI (nie oznaczaj jako ręczne)
          await queries.insertAIField(articleId, fieldName, true, 0.9);
        } else {
          await helpers.updateArticleField(articleId, fieldName, oldValue, newValue, 'user');
        }
      }
    }
    
    // Aktualizuj artykuł
    await queries.updateArticle(
      title, titleHotnews, titleSocial, titleSeo,
      lead, description, author,
      JSON.stringify(sources),
      JSON.stringify(categories),
      JSON.stringify(tags),
      status,
      articleId
    );
    
    return NextResponse.json({
      success: true,
      message: 'Artykuł został zaktualizowany'
    });
    
  } catch (error) {
    console.error('Błąd aktualizacji artykułu:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera' },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/[id] - usuń artykuł
export async function DELETE(request, { params }) {
  try {
    const articleId = params.id;
    
    const result = await queries.deleteArticle(articleId);
    
    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Artykuł nie znaleziony' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Artykuł został usunięty'
    });
    
  } catch (error) {
    console.error('Błąd usuwania artykułu:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd serwera' },
      { status: 500 }
    );
  }
} 