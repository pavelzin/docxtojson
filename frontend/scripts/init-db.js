const { initializeDatabase } = require('../lib/database');

async function initAuth() {
  // Import z ESM w CommonJS
  const { initAuthDB } = await import('../lib/auth.js');
  return initAuthDB();
}

async function main() {
  console.log('🚀 Inicjalizuję bazę danych...');

  try {
    await initializeDatabase();
    console.log('✅ Baza artykułów została pomyślnie utworzona!');
    
    await initAuth();
    console.log('✅ Baza autoryzacji została pomyślnie utworzona!');
    console.log('👤 Domyślny użytkownik: admin/admin123');
    
    console.log('📁 Lokalizacja: articles.db');
    process.exit(0);
  } catch (error) {
    console.error('❌ Błąd podczas inicjalizacji bazy danych:', error);
    process.exit(1);
  }
}

main(); 