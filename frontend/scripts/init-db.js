const { initializeDatabase } = require('../lib/database');

async function main() {
  console.log('🚀 Inicjalizuję bazę danych...');

  try {
    await initializeDatabase();
    console.log('✅ Baza danych została pomyślnie utworzona!');
    console.log('📁 Lokalizacja: articles.db');
    process.exit(0);
  } catch (error) {
    console.error('❌ Błąd podczas inicjalizacji bazy danych:', error);
    process.exit(1);
  }
}

main(); 