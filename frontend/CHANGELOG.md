# Changelog

Format inspirowany Keep a Changelog. Daty w formacie YYYY-MM-DD.

## [1.3.0] - 2025-08-18
### Zmienione
- Eksport FTP do jednego katalogu docelowego (bez podkatalogów per artykuł). Katalog określa `FTP_BASE_DIR` (względnie względem katalogu startowego konta FTP), a przy jego braku używany jest katalog bieżący (`.`).
- Obrazy wysyłane ZANIM powstanie `articles.json`. Dodane krótkie opóźnienie przed uploadem JSON: `FTP_JSON_DELAY_MS` (domyślnie 1500 ms), aby CMS miał czas „zobaczyć” nowe pliki.
- Unikalne nazwy plików graficznych: `articleId_slug[-N].ext` (w ramach jednego eksportu unikamy kolizji).
- W JSON w polu `images[].url` zapisujemy samą nazwę pliku obrazu (bez prefiksu `file:///`).
- Ścieżki FTP są względne (nie używamy `/` jako katalogu root), co poprawia kompatybilność z serwerami FTP.

### Usunięte
- Rezygnacja z użycia modułu `crypto` do tworzenia hashy w API eksportu.

### Repozytorium
- Ignorowanie obrazów w repozytorium (`frontend/public/images/*`) z pozostawieniem `frontend/public/images/.gitkeep`.
- `frontend/articles.db` przestał być śledzony przez Git i został dodany do `.gitignore`.

## [1.0.0] - 2025-08-14
### Dodane
- Początkowa wersja frontendu (Next.js) z edycją artykułów, eksportem i integracjami podstawowymi.

---

[1.3.0]: https://github.com/pavelzin/docxtojson/tree/v1.3
[1.0.0]: https://github.com/pavelzin/docxtojson


