const fs = require('fs').promises;
const path = require('path');
const { helpers, initializeDatabase } = require('../lib/database');

async function seedDatabase() {
  console.log('🌱 Seeduję bazę danych...');
  
  try {
    // Najpierw inicjalizuj bazę
    await initializeDatabase();
    
    // Ścieżka do pliku all-articles.json
    const outputPath = path.join(process.cwd(), '..', 'output', 'all-articles.json');
    
    // Sprawdź czy plik istnieje
    try {
      await fs.access(outputPath);
    } catch (error) {
      console.log('⚠️  Plik all-articles.json nie istnieje. Uruchom najpierw parser DOCX.');
      console.log('💡 Komenda: cd .. && npm start batch');
      return;
    }
    
    // Wczytaj dane
    const jsonData = await fs.readFile(outputPath, 'utf8');
    const { articles } = JSON.parse(jsonData);
    
    console.log(`📄 Znaleziono ${articles.length} artykułów do importu`);
    
    let importedCount = 0;
    let skippedCount = 0;
    
    // Importuj każdy artykuł
    for (const article of articles) {
      try {
        console.log(`📝 Importuję: ${article.title}`);
        await helpers.importArticleFromParser(article);
        importedCount++;
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`⏭️  Pomijam (już istnieje): ${article.title}`);
          skippedCount++;
        } else {
          console.error(`❌ Błąd importu artykułu ${article.articleId}:`, error.message);
        }
      }
    }
    
    console.log('');
    console.log('✅ Import zakończony!');
    console.log(`📊 Statystyki:`);
    console.log(`   - Zaimportowano: ${importedCount}`);
    console.log(`   - Pominięto: ${skippedCount}`);
    console.log(`   - Łącznie w bazie: ${importedCount + skippedCount}`);
    
  } catch (error) {
    console.error('❌ Błąd podczas seedowania:', error);
    process.exit(1);
  }
}

// Uruchom jeśli wywołany bezpośrednio
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedDatabase }; 