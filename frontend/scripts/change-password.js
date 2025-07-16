const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');

async function changeAdminPassword() {
  // Pobierz argumenty z linii komend
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('❌ Użycie: node change-password.js <username> <new_password>');
    process.exit(1);
  }
  
  const username = args[0];
  const newPassword = args[1];
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  
  console.log(`🔄 Zmieniam hasło użytkownika ${username}...`);
  
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

    // Sprawdzenie czy użytkownik istnieje
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
      if (err) {
        console.error('❌ Błąd:', err);
        db.close();
        return;
      }

      if (row) {
        // Update istniejącego użytkownika
        db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
          if (err) {
            console.error('❌ Błąd aktualizacji:', err);
          } else {
            console.log('✅ Hasło zostało zmienione!');
            console.log(`👤 Użytkownik: ${username}`);
            console.log(`🔐 Nowe hasło: ${newPassword}`);
          }
          db.close();
        });
      } else {
        // Tworzenie nowego użytkownika
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
          if (err) {
            console.error('❌ Błąd tworzenia użytkownika:', err);
          } else {
            console.log(`✅ Utworzono użytkownika ${username}!`);
            console.log(`👤 Użytkownik: ${username}`);
            console.log(`🔐 Hasło: ${newPassword}`);
          }
          db.close();
        });
      }
    });
  });
}

changeAdminPassword(); 