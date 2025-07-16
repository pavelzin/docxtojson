# 🖥️ DOCX Editor Frontend

Nowoczesny interfejs użytkownika do zarządzania artykułami z parsera DOCX na JSON. Stworzony z myślą o zespołach content, którzy potrzebują przyjaznego narzędzia do edycji i eksportu artykułów.

## ✨ Funkcje

- 📋 **Lista artykułów** z wyszukiwaniem i filtrowaniem
- ✏️ **Przyjazny edytor** z oznaczeniem pól wygenerowanych przez AI
- 🤖 **Informacja o źródle danych** - jasne rozróżnienie między AI a treścią ręczną
- 📤 **Export do Google Drive** z automatyczną strukturą katalogów
- 🔄 **Import z parsera** lub przesyłanie plików JSON
- 📱 **Responsywny design** działający na wszystkich urządzeniach

## 🚀 Instalacja

### 1. Przygotowanie

```bash
# Przejdź do katalogu frontend
cd frontend

# Zainstaluj zależności
npm install
```

### 2. Inicjalizacja bazy danych

```bash
# Utwórz bazę danych SQLite
npm run db:init

# [Opcjonalnie] Zaimportuj istniejące artykuły z parsera
npm run db:seed
```

### 3. Uruchomienie

```bash
# Tryb deweloperski
npm run dev

# Produkcja
npm run build
npm start
```

Aplikacja będzie dostępna pod adresem: `http://localhost:3000`

## 📚 Jak używać

### Import artykułów

#### Z parsera DOCX (automatyczny)
1. W głównym katalogu uruchom: `npm start batch`
2. W interfejsie przejdź do **Import → Import z parsera DOCX**
3. Kliknij **"📁 Importuj z parsera"**

#### Upload plików JSON
1. Przejdź do **Import → Upload plików JSON**
2. Przeciągnij pliki JSON lub wybierz z dysku
3. System automatycznie przetworzy i zaimportuje artykuły

### Edycja artykułów

1. Na liście artykułów kliknij **"Edytuj"**
2. **Oznaczenia pól**:
   - 🤖 **Fioletowa ikonka + "AI"** = wygenerowane przez sztuczną inteligencję
   - ✋ **Zielona ikonka + "Ręczne"** = pochodzące z dokumentu lub edytowane ręcznie
3. **Edytuj pola**:
   - Tytuły (główny, Hot News, Social, SEO)
   - Lead i treść artykułu
   - Tagi i kategorie (po jednym na linię)
   - Status publikacji
4. Kliknij **"Zapisz zmiany"**

### Export do Google Drive

1. Na liście artykułów kliknij **"📥 Export"** lub w edytorze
2. Pobierze się archiwum ZIP z:
   - **Struktura katalogów**: `Artykuły 2025/LIPIEC 2025/[Tytuł artykułu]/`
   - **Pliki**: JSON artykułu, README, podgląd HTML
3. Rozpakuj i przenieś do Google Drive zgodnie z instrukcjami w README

## 🏗️ Architektura

### Frontend
- **Next.js 14** - framework React z App Router
- **TailwindCSS** - stylowanie
- **React Hook Form** - zarządzanie formularzami
- **Heroicons** - ikony
- **React Hot Toast** - powiadomienia

### Backend
- **SQLite + better-sqlite3** - baza danych
- **Next.js API Routes** - endpoints RESTowe
- **Archiver** - tworzenie archiwów ZIP

### Struktura bazy danych

```sql
-- Główna tabela artykułów
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  article_id TEXT UNIQUE,
  title TEXT,
  title_hotnews TEXT,
  title_social TEXT,
  title_seo TEXT,
  lead TEXT,
  description TEXT,
  author TEXT,
  sources TEXT, -- JSON
  categories TEXT, -- JSON
  tags TEXT, -- JSON
  status TEXT DEFAULT 'draft',
  created_at DATETIME,
  updated_at DATETIME
);

-- Śledzenie pól AI
CREATE TABLE ai_generated_fields (
  id INTEGER PRIMARY KEY,
  article_id TEXT,
  field_name TEXT,
  is_ai_generated BOOLEAN,
  ai_confidence REAL,
  generation_date DATETIME
);

-- Historia edycji
CREATE TABLE edit_history (
  id INTEGER PRIMARY KEY,
  article_id TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  edited_by TEXT,
  edited_at DATETIME
);
```

## 🔧 API Endpoints

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/articles` | GET | Lista wszystkich artykułów |
| `/api/articles` | POST | Import artykułów JSON |
| `/api/articles/[id]` | GET | Pobierz artykuł |
| `/api/articles/[id]` | PUT | Aktualizuj artykuł |
| `/api/articles/[id]` | DELETE | Usuń artykuł |
| `/api/articles/sync-from-parser` | POST | Import z parsera DOCX |
| `/api/export/[id]` | GET | Export artykułu (ZIP) |

## 🎨 Komponenty UI

### Oznaczenia pól

- **🤖 AI Badge** - fioletowy, pokazuje % pewności AI
- **✋ Manual Badge** - zielony, dla pól ręcznych
- **Ikony w polach** - SparklesIcon (AI) / UserIcon (ręczne)

### Statusy artykułów

- **📄 Szkic** - żółty badge
- **✅ Opublikowany** - zielony badge  
- **📦 Zarchiwizowany** - szary badge

## 🔍 Wyszukiwanie i filtrowanie

- **Tekst**: wyszukuje w tytule, lead i tagach
- **Status**: filtr po statusie publikacji
- **Licznik wyników**: pokazuje liczbę znalezionych artykułów

## 🚨 Obsługa błędów

- **Toast notifications** - powiadomienia o sukcesie/błędzie
- **Walidacja formularzy** - wymagane pola, limity znaków
- **Graceful fallbacks** - gdy nie ma artykułów, błędy API
- **Loading states** - wskaźniki ładowania

## 📱 Responsywność

- **Desktop**: pełny interfejs z sidebar
- **Tablet**: zoptymalizowane kolumny
- **Mobile**: stack layout, touch-friendly

## 🛠️ Skrypty

```bash
# Podstawowe
npm run dev          # Start deweloperski
npm run build        # Build produkcyjny
npm start           # Start produkcyjny

# Baza danych
npm run db:init     # Inicjalizacja SQLite
npm run db:seed     # Import z parsera DOCX

# Jakość kodu
npm run lint        # ESLint
npm run type-check  # TypeScript check
```

## 🔮 Przyszłe funkcje

- 🔍 **Zaawansowane wyszukiwanie** - pełnotekstowe, po kategoriach
- 📊 **Dashboard analytics** - statystyki, wykresy
- 👥 **Multi-user support** - role, uprawnienia
- 🔄 **Auto-sync** - automatyczna synchronizacja z parserem
- 📝 **WYSIWYG editor** - edytor treści HTML
- 🌐 **Integracja Google Drive** - bezpośrednie połączenie API

## 🤝 Wsparcie

Jeśli masz pytania lub potrzebujesz pomocy:

1. Sprawdź sekcję **💡 Wskazówki** w interfejsie importu
2. Przeczytaj komunikaty błędów - zawierają konkretne instrukcje
3. Sprawdź console w narzędziach deweloperskich przeglądarki

---

**Stworzono z ❤️ dla zespołów content** 

Frontend DOCX Editor • v1.0 • Made with Next.js & TailwindCSS 