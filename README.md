# 📄 DOCX to JSON Converter + Frontend

Kompletny system do konwersji plików DOCX na JSON z nowoczesnym interfejsem użytkownika. Składa się z parsera CLI oraz frontendu webowego do zarządzania artykułami.

## 🌟 Co to jest?

**Parser DOCX** konwertuje pliki Word (.docx) na struktury JSON gotowe dla systemów CMS, automatycznie generując metadane przez AI.

**Frontend Web** to przyjazny interfejs do przeglądania, edycji i eksportu artykułów z jasnym oznaczeniem pól wygenerowanych przez AI.

## 🏗️ Architektura systemu

```
docxtojson/
├── 📁 input/           # Pliki DOCX do konwersji
├── 📁 output/          # Wygenerowane pliki JSON
├── 📁 frontend/        # Aplikacja webowa (Next.js)
├── index.js            # Parser CLI
└── package.json        # Zależności parsera
```

## 🚀 Szybki start

### 1. Przygotowanie projektu

```bash
# Sklonuj lub pobierz projekt
cd docxtojson

# Zainstaluj zależności parsera
npm install

# Utwórz plik konfiguracyjny AI
cp .env.example .env
# Dodaj swój klucz OpenAI API do .env
```

### 2. Uruchom parser DOCX

```bash
# Dodaj pliki DOCX do katalogu input/
cp "twoj-artykul.docx" input/

# Konwertuj wszystkie pliki
npm start batch

# Sprawdź wyniki w output/
ls output/
```

### 3. Uruchom frontend

```bash
# Przejdź do katalogu frontend
cd frontend

# Zainstaluj zależności
npm install

# Inicjalizuj bazę danych
npm run db:init

# Zaimportuj artykuły z parsera
npm run db:seed

# Uruchom aplikację
npm run dev
```

Frontend będzie dostępny pod: `http://localhost:3000`

## ✨ Główne funkcje

### 🔧 Parser DOCX (CLI)
- ✅ **Inteligentne parsowanie** - uniwersalny algorytm dla różnych struktur DOCX
- 🤖 **Generowanie metadanych przez AI** - tytuły SEO, tagi, kategorie
- 📝 **Wyciąganie treści** - tytuł, lead, opis HTML
- 📦 **Batch processing** - przetwarzanie wielu plików jednocześnie
- 🎯 **Format gotowy do CMS** - JSON kompatybilny z Polsat News

### 🖥️ Frontend Web
- 📋 **Lista artykułów** z wyszukiwaniem i filtrowaniem
- ✏️ **Przyjazny edytor** z walidacją i auto-zapisem
- 🤖 **Oznaczenia AI** - jasne rozróżnienie między AI a treścią ręczną
- 📤 **Export Google Drive** - automatyczna struktura katalogów
- 🔄 **Import z parsera** - synchronizacja jednym kliknięciem
- 📱 **Responsywny design** - działa na wszystkich urządzeniach

## 📊 Format wyjściowy JSON

```json
{
  "articles": [
    {
      "articleId": "ART1752669808002_binyz",
      "title": "Tytuł z dokumentu",
      "titleHotnews": "Skrócony tytuł (AI)",
      "titleSocial": "Tytuł dla social media (AI)",
      "titleSeo": "Tytuł SEO (AI)",
      "lead": "Lead z dokumentu",
      "description": "Treść HTML z dokumentu",
      "author": "Redakcja",
      "sources": ["red"],
      "categories": ["Kategoria1", "Kategoria2"],
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
    }
  ]
}
```

## 🔄 Workflow zespołu content

### 1. **Przygotowanie artykułów**
- Zapisz artykuły w formacie DOCX
- Umieść w katalogu `input/`

### 2. **Automatyczna konwersja**
```bash
npm start batch
```

### 3. **Przegląd w interfejsie**
- Otwórz frontend: `http://localhost:3000`
- Zaimportuj artykuły: **Import → Import z parsera**

### 4. **Edycja i kontrola jakości**
- Sprawdź pola oznaczone jako 🤖 AI
- Edytuj tytuły, tagi i kategorie
- Dostosuj treść jeśli potrzeba

### 5. **Export do Google Drive**
- Kliknij **📥 Export** przy artykule
- Pobierz archiwum ZIP z prawidłową strukturą katalogów
- Rozpakuj i przenieś do Google Drive

## 🌍 Struktura Google Drive

System automatycznie tworzy strukturę katalogów:

```
📁 Artykuły 2025/
  └── 📁 STYCZEŃ 2025/
      └── 📁 Tytuł artykułu/
          ├── 📄 artykul.json
          ├── 📄 README.md
          └── 📄 podglad.html
```

## 🛠️ Dostępne komendy

### Parser CLI
```bash
npm start batch                    # Konwertuj wszystkie pliki z input/
npm start convert --file plik.docx # Konwertuj pojedynczy plik
```

### Frontend
```bash
cd frontend
npm run dev        # Start deweloperski
npm run build      # Build produkcyjny
npm run db:init    # Inicjalizacja bazy danych
npm run db:seed    # Import z parsera
```

## 🎯 Dla zespołów content

### Oznaczenia w interfejsie:
- 🤖 **AI Badge** = pole wygenerowane przez sztuczną inteligencję
- ✋ **Ręczne Badge** = pole z dokumentu lub edytowane ręcznie
- 📊 **Pewność AI** = procentowa pewność generacji (90%+)

### Najlepsze praktyki:
1. **Sprawdź pola AI** - zwłaszcza tytuły SEO i tagi
2. **Dostosuj do marki** - upewnij się że ton jest odpowiedni
3. **Kontrola jakości** - sprawdź długość tytułów (SEO: 60-80 znaków)
4. **Export grupowy** - używaj struktury Google Drive

## 🔧 Wymagania techniczne

### Parser
- Node.js 18+
- OpenAI API Key
- ~50MB miejsca na dysku

### Frontend
- Node.js 18+
- SQLite3
- ~200MB miejsca na dysku

## 🚨 Rozwiązywanie problemów

### Parser nie działa
```bash
# Sprawdź klucz API
echo $OPENAI_API_KEY

# Reinstaluj zależności
rm -rf node_modules package-lock.json
npm install
```

### Frontend nie łączy się z parserem
```bash
# Sprawdź czy plik all-articles.json istnieje
ls output/all-articles.json

# Uruchom parser jeśli nie ma pliku
npm start batch
```

### Baza danych nie działa
```bash
cd frontend
rm articles.db      # Usuń bazę
npm run db:init     # Utwórz nową
npm run db:seed     # Importuj dane
```

## 📈 Statystyki wydajności

- **Parser**: ~10-30 artykułów/minutę (zależnie od API AI)
- **Frontend**: Obsługuje 1000+ artykułów bez problemów
- **Export**: ~5 sekund/artykuł z pełną strukturą

## 🔮 Roadmapa

### Najbliższe funkcje
- 🔍 **Zaawansowane wyszukiwanie** pełnotekstowe
- 📊 **Dashboard analytics** z wykresami
- 🌐 **Integracja Google Drive API** - bezpośredni upload
- 👥 **Multi-user support** - role i uprawnienia

### Długoterminowe plany
- 📝 **WYSIWYG editor** treści HTML
- 🔄 **Auto-sync** z folderem DOCX
- 📱 **Aplikacja mobilna**
- 🤖 **Ulepszona AI** z custom promptami

## 💝 Dla zespołów

Ten projekt został stworzony z myślą o zespołach content, którzy:
- Potrzebują szybko przetwarzać dużo artykułów
- Chcą kontrolować jakość treści generowanych przez AI
- Wymagają spójnej struktury danych
- Pracują z Google Drive i systemami CMS

---

**📧 Potrzebujesz pomocy?** Sprawdź README w katalogach `/` (parser) i `/frontend/` (interfejs)

**🚀 Gotowy do testowania?** Rozpocznij od `npm start batch` i zobacz magia w akcji!

*Stworzono z ❤️ dla zespołów content • Parser + Frontend • v1.0* 