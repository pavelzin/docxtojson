const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

// Inicjalizacja bazy danych
// Użyj zmiennej środowiskowej lub domyślnej ścieżki bezwzględnej
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'frontend', 'articles.db');
console.log('🗄️ Ścieżka do bazy danych:', dbPath);
const db = new sqlite3.Database(dbPath);

// Promisify metod SQLite3 - POPRAWKA dla lastID
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      }
    });
  });
};

const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Wydobywa autora zdjęcia z nazwy pliku, bazując na ostatnim segmencie po znakach "_"
// Przykład: "..._zdjęcie główne_Pexels.jpg" -> "Pexels"
function extractPhotoAuthorFromFilename(filename) {
  try {
    if (!filename || typeof filename !== 'string') return null;
    const base = filename.split('/').pop();
    const withoutExt = base.replace(/\.[^.]+$/, '');
    const segments = withoutExt.split('_');
    const candidate = segments[segments.length - 1].trim();
    return candidate || null;
  } catch {
    return null;
  }
}

// Schemat bazy danych
const initializeDatabase = async () => {
  try {
    // Tabela artykułów
    await dbRun(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        title_hotnews TEXT,
        title_social TEXT,
        title_seo TEXT,
        lead TEXT,
        description TEXT,
        author TEXT,
        sources TEXT, -- JSON array
        categories TEXT, -- JSON array 
        tags TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'draft' -- draft, published, archived
      )
    `);

    // Migracja: dodaj nowe kolumny jeśli nie istnieją
    try {
      await dbRun(`ALTER TABLE articles ADD COLUMN imported_from TEXT`);
      console.log('Dodano kolumnę imported_from');
    } catch (e) {
      // Kolumna już istnieje
    }
    
    try {
      await dbRun(`ALTER TABLE articles ADD COLUMN drive_path TEXT`);
      console.log('Dodano kolumnę drive_path');
    } catch (e) {
      // Kolumna już istnieje
    }
    
    try {
      await dbRun(`ALTER TABLE articles ADD COLUMN original_filename TEXT`);
      console.log('Dodano kolumnę original_filename');
    } catch (e) {
      // Kolumna już istnieje
    }

    // Kolumna na nazwę pliku obrazu
    try {
      await dbRun(`ALTER TABLE articles ADD COLUMN image_filename TEXT`);
      console.log('Dodano kolumnę image_filename');
    } catch (e) {
      // Kolumna już istnieje
    }

    // Kolumna na autora zdjęcia (photoAuthor)
    try {
      await dbRun(`ALTER TABLE articles ADD COLUMN photo_author TEXT`);
      console.log('Dodano kolumnę photo_author');
    } catch (e) {
      // Kolumna już istnieje
    }

    // Tabela dla śledzenia synchronizacji Google Drive
    await dbRun(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL, -- 'full', 'incremental', 'month'
        target_month TEXT, -- NULL dla full, nazwa miesiąca dla month
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
        processed_count INTEGER DEFAULT 0,
        imported_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        error_message TEXT,
        last_file_modified DATETIME -- najnowszy plik z tej synchronizacji
      )
    `);

    // Tabela dla metadanych plików Drive (cache)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS drive_files_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL, -- np. "LIPIEC 2025/Artykuł o psach"
        modified_time DATETIME NOT NULL,
        size INTEGER,
        last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_processed BOOLEAN DEFAULT FALSE
      )
    `);

    // Tabela dla śledzenia pól wygenerowanych przez AI
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_generated_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        is_ai_generated BOOLEAN DEFAULT TRUE,
        generation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        ai_confidence REAL DEFAULT 1.0,
        FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE,
        UNIQUE(article_id, field_name)
      )
    `);

    // Tabela dla historii edycji
    await dbRun(`
      CREATE TABLE IF NOT EXISTS edit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        edited_by TEXT DEFAULT 'user',
        edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE
      )
    `);

    // Tabela dla szablonów promptów AI (edycja w UI)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_prompt_templates (
        field_name TEXT PRIMARY KEY,
        prompt_text TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indeksy
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_articles_article_id ON articles(article_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_articles_drive_path ON articles(drive_path)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log(started_at)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_drive_files_modified_time ON drive_files_cache(modified_time)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_drive_files_path ON drive_files_cache(file_path)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_ai_fields_article_id ON ai_generated_fields(article_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_edit_history_article_id ON edit_history(article_id)`);

    console.log('✅ Baza danych została zainicjalizowana');
  } catch (error) {
    console.error('❌ Błąd inicjalizacji bazy danych:', error);
    throw error;
  }
};

// Funkcje do zarządzania artykułami
const articleQueries = {
  // Pobierz wszystkie artykuły z informacją o polach AI
  getAllArticles: async () => {
    return await dbAll(`
      SELECT 
        a.*,
        GROUP_CONCAT(
          CASE WHEN aif.is_ai_generated = 1 
          THEN aif.field_name 
          ELSE NULL END
        ) as ai_fields
      FROM articles a
      LEFT JOIN ai_generated_fields aif ON a.article_id = aif.article_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
  },

  // Pobierz pojedynczy artykuł
  getArticleById: async (articleId) => {
    return await dbGet(`SELECT * FROM articles WHERE article_id = ?`, [articleId]);
  },

  // Sprawdź czy artykuł z danej ścieżki już istnieje
  getArticleByPath: async (drivePath, filename) => {
    return await dbGet(`
      SELECT * FROM articles 
      WHERE drive_path = ? AND original_filename = ?
    `, [drivePath, filename]);
  },

  // Sprawdź czy artykuł z tym tytułem już istnieje
  getArticleByTitle: async (title) => {
    return await dbGet(`
      SELECT * FROM articles 
      WHERE title = ?
    `, [title]);
  },

  // Pobierz pola AI dla artykułu
  getAIFieldsForArticle: async (articleId) => {
    return await dbAll(`
      SELECT field_name, is_ai_generated, generation_date, ai_confidence 
      FROM ai_generated_fields 
      WHERE article_id = ?
    `, [articleId]);
  },

  // Wstaw nowy artykuł
  insertArticle: async (articleId, title, titleHotnews, titleSocial, titleSeo,
                        lead, description, author, sources, categories, tags, status,
                        importedFrom = null, drivePath = null, originalFilename = null) => {
    return await dbRun(`
      INSERT INTO articles (
        article_id, title, title_hotnews, title_social, title_seo,
        lead, description, author, sources, categories, tags, status,
        imported_from, drive_path, original_filename
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [articleId, title, titleHotnews, titleSocial, titleSeo,
        lead, description, author, sources, categories, tags, status,
        importedFrom, drivePath, originalFilename]);
  },

  // Aktualizuj artykuł
  updateArticle: async (title, titleHotnews, titleSocial, titleSeo,
                       lead, description, author, sources, categories, tags, status, articleId) => {
    return await dbRun(`
      UPDATE articles SET
        title = ?, title_hotnews = ?, title_social = ?, title_seo = ?,
        lead = ?, description = ?, author = ?, sources = ?, 
        categories = ?, tags = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE article_id = ?
    `, [title, titleHotnews, titleSocial, titleSeo,
        lead, description, author, sources, categories, tags, status, articleId]);
  },

  // Usuń artykuł
  deleteArticle: async (articleId) => {
    return await dbRun(`DELETE FROM articles WHERE article_id = ?`, [articleId]);
  },

  // Ustaw nazwę pliku obrazu powiązaną z artykułem
  setArticleImageFilename: async (articleId, imageFilename) => {
    const photoAuthor = extractPhotoAuthorFromFilename(imageFilename);
    return await dbRun(`
      UPDATE articles SET 
        image_filename = ?, 
        photo_author = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE article_id = ?
    `, [imageFilename, photoAuthor, articleId]);
  },

  // Wstaw informację o polu AI
  insertAIField: async (articleId, fieldName, isAI, confidence) => {
    return await dbRun(`
      INSERT OR REPLACE INTO ai_generated_fields (
        article_id, field_name, is_ai_generated, ai_confidence
      ) VALUES (?, ?, ?, ?)
    `, [articleId, fieldName, isAI, confidence]);
  },

  // Aktualizuj status pola AI (gdy użytkownik edytuje)
  updateAIFieldStatus: async (articleId, fieldName) => {
    return await dbRun(`
      UPDATE ai_generated_fields 
      SET is_ai_generated = FALSE 
      WHERE article_id = ? AND field_name = ?
    `, [articleId, fieldName]);
  },

  // Dodaj wpis do historii edycji
  insertEditHistory: async (articleId, fieldName, oldValue, newValue, editedBy) => {
    return await dbRun(`
      INSERT INTO edit_history (
        article_id, field_name, old_value, new_value, edited_by
      ) VALUES (?, ?, ?, ?, ?)
    `, [articleId, fieldName, oldValue, newValue, editedBy]);
  },

  // === SYNCHRONIZACJA GOOGLE DRIVE ===

  // Rozpocznij nową synchronizację
  startSync: async (syncType, targetMonth = null) => {
    const result = await dbRun(`
      INSERT INTO sync_log (sync_type, target_month, status)
      VALUES (?, ?, 'running')
    `, [syncType, targetMonth]);
    return result.lastID;
  },

  // Zakończ synchronizację
  completeSync: async (syncId, processed, imported, skipped, errorMessage = null) => {
    const status = errorMessage ? 'failed' : 'completed';
    return await dbRun(`
      UPDATE sync_log SET
        completed_at = CURRENT_TIMESTAMP,
        status = ?,
        processed_count = ?,
        imported_count = ?,
        skipped_count = ?,
        error_message = ?
      WHERE id = ?
    `, [status, processed, imported, skipped, errorMessage, syncId]);
  },

  // Pobierz ostatnią udaną synchronizację
  getLastSuccessfulSync: async (syncType = null) => {
    let query = `
      SELECT * FROM sync_log 
      WHERE status = 'completed'
    `;
    const params = [];
    
    if (syncType) {
      query += ` AND sync_type = ?`;
      params.push(syncType);
    }
    
    query += ` ORDER BY completed_at DESC LIMIT 1`;
    
    return await dbGet(query, params);
  },

  // Zapisz/aktualizuj metadane pliku Drive
  upsertDriveFileCache: async (fileId, fileName, filePath, modifiedTime, size) => {
    return await dbRun(`
      INSERT OR REPLACE INTO drive_files_cache 
      (file_id, file_name, file_path, modified_time, size, last_checked)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [fileId, fileName, filePath, modifiedTime, size]);
  },

  // Sprawdź czy plik był już przetworzony
  getDriveFileCache: async (fileId) => {
    return await dbGet(`
      SELECT * FROM drive_files_cache WHERE file_id = ?
    `, [fileId]);
  },

  // Pobierz pliki nowsze niż ostatnia synchronizacja
  getNewDriveFiles: async (sinceDate) => {
    return await dbAll(`
      SELECT * FROM drive_files_cache 
      WHERE modified_time > ? AND is_processed = FALSE
      ORDER BY modified_time DESC
    `, [sinceDate]);
  },

  // Oznacz plik jako przetworzony
  markDriveFileAsProcessed: async (fileId, isProcessed = true) => {
    return await dbRun(`
      UPDATE drive_files_cache 
      SET is_processed = ?, last_checked = CURRENT_TIMESTAMP
      WHERE file_id = ?
    `, [isProcessed, fileId]);
  },

  // Pobierz statystyki synchronizacji
  getSyncStats: async (limit = 10) => {
    return await dbAll(`
      SELECT 
        sync_type,
        target_month,
        started_at,
        completed_at,
        status,
        processed_count,
        imported_count,
        skipped_count,
        error_message
      FROM sync_log 
      ORDER BY started_at DESC 
      LIMIT ?
    `, [limit]);
  },

  // Wyczyść cache starszych plików (opcjonalne, do housekeeping)
  cleanOldDriveCache: async (olderThanDays = 30) => {
    return await dbRun(`
      DELETE FROM drive_files_cache 
      WHERE last_checked < datetime('now', '-${olderThanDays} days')
    `);
  }
};

// Funkcje pomocnicze
const helpers = {
  // Zapisz domyślne prompty jeśli nie istnieją
  ensureDefaultPrompts: async () => {
    const defaults = {
      title_hotnews: 'Na podstawie tytułu, leadu i treści wygeneruj krótki, chwytliwy tytuł do maks. 50 znaków. Nie dodawaj cudzysłowów. Zwróć tylko tytuł.',
      title_social: 'Na podstawie tytułu, leadu i treści wygeneruj tytuł do social media (FB/Discover) – emocjonalny, ale rzetelny, zachęcający do kliknięcia. 70–120 znaków. Zwróć tylko tytuł.',
      title_seo: 'Na podstawie tytułu, leadu i treści wygeneruj tytuł SEO 60–80 znaków z kluczowymi frazami, naturalny, bez clickbaitu. Zwróć tylko tytuł.',
      tags: 'Na podstawie tytułu, leadu i treści wygeneruj dokładnie 5 zwięzłych tagów tematycznych po polsku, oddzielonych przecinkami (bez hasztagów). Zwróć tylko listę tagów rozdzielonych przecinkami.'
    };
    for (const [field, text] of Object.entries(defaults)) {
      await dbRun(
        `INSERT OR IGNORE INTO ai_prompt_templates (field_name, prompt_text) VALUES (?, ?)`,
        [field, text]
      );
    }
  },
  // Importuj artykuł z parsera JSON
  importArticleFromParser: async (articleData) => {
    try {
      // Rozpocznij transakcję
      await dbRun('BEGIN TRANSACTION');

      // Wstaw artykuł
      await articleQueries.insertArticle(
        articleData.articleId,
        articleData.title,
        articleData.titleHotnews,
        articleData.titleSocial,
        articleData.titleSeo,
        articleData.lead,
        articleData.description,
        articleData.author,
        JSON.stringify(articleData.sources),
        JSON.stringify(articleData.categories),
        JSON.stringify(articleData.tags),
        'draft'
      );

      // Oznacz pola wygenerowane przez AI
      const aiFields = [
        'title_hotnews', 'title_social', 'title_seo', 
        'categories', 'tags'
      ];
      
      for (const field of aiFields) {
        await articleQueries.insertAIField(
          articleData.articleId, 
          field, 
          true, 
          0.9 // wysoka pewność AI
        );
      }

      // Pola z dokumentu (nie AI)
      const manualFields = ['title', 'lead', 'description'];
      for (const field of manualFields) {
        await articleQueries.insertAIField(
          articleData.articleId, 
          field, 
          false, 
          1.0
        );
      }

      // Zatwierdź transakcję
      await dbRun('COMMIT');
      return articleData.articleId;

    } catch (error) {
      // Wycofaj transakcję w przypadku błędu
      await dbRun('ROLLBACK');
      throw error;
    }
  },

  // Aktualizuj pole artykułu i zaznacz jako edytowane przez użytkownika
  updateArticleField: async (articleId, fieldName, oldValue, newValue, editedBy = 'user') => {
    try {
      await dbRun('BEGIN TRANSACTION');

      // Zapisz historię edycji
      await articleQueries.insertEditHistory(
        articleId, fieldName, oldValue, newValue, editedBy
      );

      // Oznacz pole jako nieedytowane przez AI
      await articleQueries.updateAIFieldStatus(articleId, fieldName);

      await dbRun('COMMIT');
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  },

  // Pobierz statystyki
  getStats: async () => {
    const totalArticles = await dbGet('SELECT COUNT(*) as count FROM articles');
    const draftArticles = await dbGet('SELECT COUNT(*) as count FROM articles WHERE status = "draft"');
    const publishedArticles = await dbGet('SELECT COUNT(*) as count FROM articles WHERE status = "published"');
    const aiFieldsCount = await dbGet('SELECT COUNT(*) as count FROM ai_generated_fields WHERE is_ai_generated = 1');

    return {
      total: totalArticles.count,
      draft: draftArticles.count,
      published: publishedArticles.count,
      aiFields: aiFieldsCount.count
    };
  }
};

// Eksportuj API
module.exports = {
  db,
  initializeDatabase,
  queries: articleQueries,
  helpers,
  // Prompty AI
  prompts: {
    getAll: async () => {
      const rows = await dbAll(`SELECT field_name, prompt_text FROM ai_prompt_templates`);
      const map = {};
      rows.forEach(r => { map[r.field_name] = r.prompt_text; });
      return map;
    },
    getOne: async (fieldName) => {
      return await dbGet(`SELECT prompt_text FROM ai_prompt_templates WHERE field_name = ?`, [fieldName]);
    },
    upsertMany: async (entries) => {
      await dbRun('BEGIN TRANSACTION');
      try {
        for (const [field, text] of Object.entries(entries)) {
          await dbRun(
            `INSERT INTO ai_prompt_templates (field_name, prompt_text, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(field_name) DO UPDATE SET prompt_text = excluded.prompt_text, updated_at = CURRENT_TIMESTAMP`,
            [field, text]
          );
        }
        await dbRun('COMMIT');
      } catch (e) {
        await dbRun('ROLLBACK');
        throw e;
      }
    }
  }
}; 