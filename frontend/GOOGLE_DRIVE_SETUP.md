# Konfiguracja Google Drive API

## 1. Utwórz projekt w Google Cloud Console

1. Idź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt lub wybierz istniejący
3. Włącz Google Drive API:
   - Idź do "APIs & Services" > "Library"
   - Wyszukaj "Google Drive API"
   - Kliknij "Enable"

## 2. Utwórz OAuth 2.0 credentials

1. Idź do "APIs & Services" > "Credentials"
2. Kliknij "Create Credentials" > "OAuth 2.0 Client ID"
3. Wybierz "Web application"
4. Dodaj autoryzowane URI przekierowania:
   - `http://localhost:3000/api/drive/callback` (development)
   - `https://yourdomain.com/api/drive/callback` (production)
5. Zapisz Client ID i Client Secret

## 3. Skonfiguruj zmienne środowiskowe

Utwórz plik `.env.local` w katalogu `frontend/`:

```env
# Google Drive API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/drive/callback

# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Opcjonalne - logowanie debug
DEBUG_GOOGLE_DRIVE=false
```

## 4. Uprawnienia Google Drive

Aplikacja potrzebuje dostępu do:
- **Google Drive API** - odczyt plików
- **Scopes:**
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/drive.file`

## 5. Struktura katalogów na Google Drive

Aplikacja oczekuje struktury:

```
[Główny folder - ID w konfiguracji]
├── STYCZEŃ 2025/
│   ├── Tytuł artykułu 1/
│   │   └── artykul.docx
│   └── Tytuł artykułu 2/
│       └── artykul.docx
├── LUTY 2025/
│   └── ...
└── MARZEC 2025/
    └── ...
```

## 6. ID głównego folderu

W pliku `frontend/lib/google-drive.js` ustaw ID głównego folderu:

```javascript
const MAIN_FOLDER_ID = '1X_b_oa2GqkW5gtLx6SMLkU-a74db1eWU';
```

Aby znaleźć ID folderu:
1. Otwórz folder w przeglądarce
2. Skopiuj ID z URL: `https://drive.google.com/drive/folders/[FOLDER_ID]`

## 7. Testowanie

1. Uruchom frontend: `npm run dev`
2. Idź do `/import`
3. Kliknij "Połącz z Google Drive"
4. Autoryzuj aplikację
5. Przeglądaj katalogi i importuj pliki DOCX

## Troubleshooting

### Błąd 401 - Unauthorized
- Sprawdź Client ID i Secret
- Sprawdź redirect URI w Google Console
- Sprawdź czy Drive API jest włączone

### Błąd 403 - Forbidden
- Sprawdź uprawnienia do folderu na Drive
- Sprawdź scopes w konfiguracji

### Błąd 404 - Not Found
- Sprawdź ID głównego folderu
- Sprawdź czy folder jest udostępniony aplikacji 