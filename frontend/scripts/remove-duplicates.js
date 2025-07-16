const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'articles.db');

async function removeDuplicates() {
  console.log('🧹 Usuwanie duplikatów artykułów...');
  
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Sprawdź stan przed usunięciem
      db.get("SELECT COUNT(*) as total FROM articles", (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`📊 Artykuły przed czyszczeniem: ${result.total}`);
      });
      
      // Sprawdź liczbę duplikatów
      db.get(`
        SELECT COUNT(*) as duplicates 
        FROM articles a1 
        WHERE EXISTS (
          SELECT 1 FROM articles a2 
          WHERE a2.title = a1.title 
          AND a2.id > a1.id
        )
      `, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`🔍 Duplikaty do usunięcia: ${result.duplicates}`);
      });
      
      // Usuń duplikaty - zostaw tylko najnowszy (najwyższe ID) dla każdego tytułu
      db.run(`
        DELETE FROM articles 
        WHERE id NOT IN (
          SELECT MAX(id) 
          FROM articles 
          GROUP BY title
        )
      `, function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`🗑️ Usunięto ${this.changes} duplikatów`);
      });
      
      // Sprawdź stan po usunięciu
      db.get("SELECT COUNT(*) as total FROM articles", (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`✅ Artykuły po czyszczeniu: ${result.total}`);
      });
      
      // Sprawdź czy zostały jakieś duplikaty
      db.get(`
        SELECT COUNT(DISTINCT title) as unique_titles,
               COUNT(*) as total_articles
        FROM articles
      `, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (result.unique_titles === result.total_articles) {
          console.log('🎉 Wszystkie duplikaty zostały usunięte!');
          console.log(`📚 Unikalne artykuły: ${result.unique_titles}`);
        } else {
          console.log(`⚠️ Nadal pozostały duplikaty: ${result.total_articles - result.unique_titles}`);
        }
        
        db.close();
        resolve();
      });
    });
  });
}

// Uruchom jeśli wywołany bezpośrednio
if (require.main === module) {
  removeDuplicates()
    .then(() => {
      console.log('✅ Czyszczenie zakończone pomyślnie!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Błąd podczas czyszczenia:', error);
      process.exit(1);
    });
}

module.exports = { removeDuplicates }; 