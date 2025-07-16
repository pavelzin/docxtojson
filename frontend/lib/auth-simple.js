const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const dbPath = path.join(process.cwd(), 'articles.db');

// Logowanie użytkownika
function loginUser(username, password) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        db.close();
        return resolve({ success: false, error: 'Błąd serwera' });
      }
      
      if (!user) {
        db.close();
        return resolve({ success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
      }

      const isValidPassword = bcrypt.compareSync(password, user.password);
      
      if (!isValidPassword) {
        db.close();
        return resolve({ success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
      }

      // Tworzenie tokena JWT
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Zapisanie sesji w bazie
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dni
      
      db.run(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt],
        function(err) {
          if (err) {
            console.error('Błąd zapisywania sesji:', err);
          }
          
          // Usuwanie starych sesji
          db.run('DELETE FROM sessions WHERE expires_at < datetime("now")', (err) => {
            db.close();
            
            resolve({
              success: true,
              token,
              user: {
                id: user.id,
                username: user.username
              }
            });
          });
        }
      );
    });
  });
}

// Weryfikacja tokena
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    if (!token) {
      return resolve({ valid: false, error: 'Brak tokena' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const db = new sqlite3.Database(dbPath);

      // Sprawdzenie czy sesja istnieje w bazie
      db.get(
        'SELECT s.*, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime("now")',
        [token],
        (err, session) => {
          db.close();
          
          if (err || !session) {
            return resolve({ valid: false, error: 'Nieprawidłowa sesja' });
          }

          resolve({
            valid: true,
            user: {
              id: session.user_id,
              username: session.username
            }
          });
        }
      );
    } catch (error) {
      resolve({ valid: false, error: 'Nieprawidłowy token' });
    }
  });
}

// Wylogowanie (usunięcie sesji)
function logoutUser(token) {
  return new Promise((resolve, reject) => {
    if (!token) return resolve({ success: false });

    const db = new sqlite3.Database(dbPath);
    
    db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
      db.close();
      
      if (err) {
        console.error('Błąd wylogowania:', err);
        return resolve({ success: false });
      }
      
      resolve({ success: true });
    });
  });
}

module.exports = {
  loginUser,
  verifyToken,
  logoutUser
}; 