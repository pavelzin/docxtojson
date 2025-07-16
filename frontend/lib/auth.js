import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { openDb } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Domyślny użytkownik admin (hasło: admin123)
const DEFAULT_USER = {
  username: 'admin',
  password: '$2a$10$8K1p/a0drteBtjM38FlEOeOlc2D9t1QC9RmF2qQvzlY7YHQ8KgaO2' // bcrypt hash dla 'admin123'
};

// Inicjalizacja tabeli użytkowników
export async function initAuthDB() {
  const db = await openDb();
  
  // Tworzenie tabeli użytkowników
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tworzenie tabeli sesji
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Dodanie domyślnego użytkownika admin jeśli nie istnieje
  const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [DEFAULT_USER.username]);
  if (!existingUser) {
    await db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [DEFAULT_USER.username, DEFAULT_USER.password]
    );
    console.log('✅ Utworzono domyślnego użytkownika: admin/admin123');
  }

  await db.close();
}

// Logowanie użytkownika
export async function loginUser(username, password) {
  const db = await openDb();
  
  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return { success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return { success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło' };
    }

    // Tworzenie tokena JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Zapisanie sesji w bazie
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dni
    await db.run(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt.toISOString()]
    );

    // Usuwanie starych sesji (starszych niż 30 dni)
    await db.run('DELETE FROM sessions WHERE expires_at < datetime("now")');

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username
      }
    };
  } catch (error) {
    console.error('Błąd logowania:', error);
    return { success: false, error: 'Błąd serwera' };
  } finally {
    await db.close();
  }
}

// Weryfikacja tokena
export async function verifyToken(token) {
  if (!token) {
    return { valid: false, error: 'Brak tokena' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await openDb();

    // Sprawdzenie czy sesja istnieje w bazie
    const session = await db.get(
      'SELECT s.*, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime("now")',
      [token]
    );

    await db.close();

    if (!session) {
      return { valid: false, error: 'Nieprawidłowa sesja' };
    }

    return {
      valid: true,
      user: {
        id: session.user_id,
        username: session.username
      }
    };
  } catch (error) {
    return { valid: false, error: 'Nieprawidłowy token' };
  }
}

// Wylogowanie (usunięcie sesji)
export async function logoutUser(token) {
  if (!token) return { success: false };

  const db = await openDb();
  
  try {
    await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    return { success: true };
  } catch (error) {
    console.error('Błąd wylogowania:', error);
    return { success: false };
  } finally {
    await db.close();
  }
}

// Middleware do sprawdzania autoryzacji
export function requireAuth(handler) {
  return async (req, res) => {
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');
    
    const verification = await verifyToken(token);
    
    if (!verification.valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = verification.user;
    return handler(req, res);
  };
}

// Hash hasła (do tworzenia nowych użytkowników)
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
} 