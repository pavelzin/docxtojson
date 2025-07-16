# 📁 Katalog input/

Tutaj umieszczaj pliki DOCX do konwersji na JSON.

## Jak to działa:

1. **Skopiuj pliki DOCX** do tego katalogu
2. **Uruchom konwersję:**
   ```bash
   npm start batch
   ```
3. **Wyniki znajdziesz w** `output/`

## Przykład:

```bash
# Dodaj pliki
cp "artykul-o-psach.docx" input/
cp "artykul-o-znakach.docx" input/

# Konwertuj wszystko
npm start batch

# Sprawdź wyniki
ls output/
# artykul-o-psach.json
# artykul-o-znakach.json  
# all-articles.json
```

## Co się dzieje:

- **Każdy plik DOCX** → osobny JSON w `output/`
- **TitleSocial** generowany automatycznie z nazwy pliku i treści
- **Zbiorczy plik** `all-articles.json` ze wszystkimi artykułami
- **Format JSON** gotowy dla Polsat News

## Obsługiwane formaty:

✅ `.docx` (Word 2007+)  
❌ `.doc` (stary Word - nie obsługiwany)  
❌ Pliki tymczasowe `~$*.docx` (pomijane)

---

**Gotowe do testowania! Dodaj pliki DOCX i uruchom `npm start batch`** 