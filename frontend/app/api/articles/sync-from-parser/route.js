import { NextResponse } from 'next/server';
import { helpers } from '@/lib/database';
import fs from 'fs/promises';
import path from 'path';

// POST /api/articles/sync-from-parser - importuj artykuły z all-articles.json
export async function POST() {
  try {
    // Ścieżka do pliku all-articles.json w głównym katalogu projektu
    const outputPath = path.join(process.cwd(), '..', 'output', 'all-articles.json');
    
    // Sprawdź czy plik istnieje
    try {
      await fs.access(outputPath);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Plik all-articles.json nie istnieje. Uruchom najpierw parser DOCX (npm start batch).'
      }, { status: 404 });
    }
    
    // Wczytaj dane z pliku
    const jsonData = await fs.readFile(outputPath, 'utf8');
    const { articles } = JSON.parse(jsonData);
    
    if (!articles || !Array.isArray(articles)) {
      return NextResponse.json({
        success: false,
        error: 'Nieprawidłowy format pliku all-articles.json'
      }, { status: 400 });
    }
    
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    // Importuj każdy artykuł
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
      total: articles.length,
      errors,
      message: `Pomyślnie zaimportowano ${importedCount} artykułów z parsera DOCX`
    });
    
  } catch (error) {
    console.error('Błąd synchronizacji z parserem:', error);
    return NextResponse.json({
      success: false,
      error: 'Błąd podczas importu z parsera: ' + error.message
    }, { status: 500 });
  }
} 