const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');

async function changeAdminPassword() {
  const newPassword = 'Secure2024DocxEdit';
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  
  console.log('🔄 Zmieniam hasło admina...');
  
  const db = new sqlite3.Database('articles.db');
  
  // Tworzenie tabel jeśli nie istnieją
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Sprawdzenie czy admin istnieje
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
      if (err) {
        console.error('❌ Błąd:', err);
        db.close();
        return;
      }

      if (row) {
        // Update istniejącego użytkownika
        db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin'], (err) => {
          if (err) {
            console.error('❌ Błąd aktualizacji:', err);
          } else {
            console.log('✅ Hasło zostało zmienione!');
            console.log('👤 Użytkownik: admin');
            console.log('🔐 Nowe hasło: ' + newPassword);
          }
          db.close();
        });
      } else {
        // Tworzenie nowego użytkownika
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword], (err) => {
          if (err) {
            console.error('❌ Błąd tworzenia użytkownika:', err);
          } else {
            console.log('✅ Utworzono użytkownika admin!');
            console.log('👤 Użytkownik: admin');
            console.log('🔐 Hasło: ' + newPassword);
          }
          db.close();
        });
      }
    });
  });
}

changeAdminPassword(); 