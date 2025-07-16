/**
 * Parser i walidator JSON dla formatu artykułów Polsatu
 * Sprawdza czy generowane pliki są zgodne z wymaganiami
 */

class PolsatValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Główna funkcja walidacji pliku JSON
   * @param {string|Object} jsonData - JSON string lub obiekt do walidacji
   * @returns {Object} Wynik walidacji z błędami i ostrzeżeniami
   */
  validate(jsonData) {
    this.errors = [];
    this.warnings = [];

    let data;
    
    // Parse JSON jeśli to string
    try {
      data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    } catch (error) {
      this.errors.push(`Nieprawidłowy JSON: ${error.message}`);
      return this.getResult();
    }

    // Walidacja struktury głównej
    this.validateMainStructure(data);

    // Walidacja każdego artykułu
    if (data.articles && Array.isArray(data.articles)) {
      data.articles.forEach((article, index) => {
        this.validateArticle(article, index);
      });
    }

    return this.getResult();
  }

  /**
   * Walidacja głównej struktury JSON
   */
  validateMainStructure(data) {
    if (!data) {
      this.errors.push('Pusty obiekt JSON');
      return;
    }

    if (!data.articles) {
      this.errors.push('Brakuje głównego pola "articles"');
      return;
    }

    if (!Array.isArray(data.articles)) {
      this.errors.push('Pole "articles" musi być tablicą');
      return;
    }

    if (data.articles.length === 0) {
      this.warnings.push('Tablica artykułów jest pusta');
    }
  }

  /**
   * Walidacja pojedynczego artykułu
   */
  validateArticle(article, index) {
    const prefix = `Artykuł [${index}]`;

    // Sprawdzenie wymaganych pól
    const requiredFields = [
      'articleId',
      'title', 
      'titleHotnews',
      'titleSocial',
      'titleSeo',
      'lead',
      'description',
      'author',
      'sources',
      'categories',
      'tags'
    ];

    requiredFields.forEach(field => {
      if (!article.hasOwnProperty(field)) {
        this.errors.push(`${prefix}: Brakuje wymaganego pola "${field}"`);
      } else if (article[field] === null || article[field] === undefined) {
        this.errors.push(`${prefix}: Pole "${field}" nie może być null/undefined`);
      }
    });

    // Walidacja typów pól
    this.validateArticleTypes(article, prefix);
    
    // Walidacja długości tekstów
    this.validateTextLengths(article, prefix);
    
    // Walidacja HTML w description
    this.validateHtmlDescription(article.description, prefix);
    
    // Walidacja tablic
    this.validateArrayFields(article, prefix);
  }

  /**
   * Walidacja typów pól artykułu
   */
  validateArticleTypes(article, prefix) {
    // String fields
    const stringFields = ['articleId', 'title', 'titleHotnews', 'titleSocial', 'titleSeo', 'lead', 'description', 'author'];
    
    stringFields.forEach(field => {
      if (article[field] && typeof article[field] !== 'string') {
        this.errors.push(`${prefix}: Pole "${field}" musi być tekstem (string)`);
      }
    });

    // Array fields
    const arrayFields = ['sources', 'categories', 'tags'];
    
    arrayFields.forEach(field => {
      if (article[field] && !Array.isArray(article[field])) {
        this.errors.push(`${prefix}: Pole "${field}" musi być tablicą`);
      }
    });
  }

  /**
   * Walidacja długości tekstów
   */
  validateTextLengths(article, prefix) {
    const limits = {
      articleId: { max: 50, min: 1 },
      title: { max: 200, min: 10 },
      titleHotnews: { max: 150, min: 10 },
      titleSocial: { max: 300, min: 10 },
      titleSeo: { max: 200, min: 10 },
      lead: { max: 500, min: 50 },
      author: { max: 100, min: 1 }
    };

    Object.keys(limits).forEach(field => {
      if (article[field]) {
        const length = article[field].length;
        const limit = limits[field];
        
        if (length < limit.min) {
          this.errors.push(`${prefix}: Pole "${field}" jest za krótkie (${length} znaków, min: ${limit.min})`);
        }
        
        if (length > limit.max) {
          this.errors.push(`${prefix}: Pole "${field}" jest za długie (${length} znaków, max: ${limit.max})`);
        }
      }
    });

    // Description - sprawdzenie minimum
    if (article.description && article.description.length < 100) {
      this.warnings.push(`${prefix}: Opis artykułu może być za krótki (${article.description.length} znaków)`);
    }
  }

  /**
   * Walidacja HTML w opisie
   */
  validateHtmlDescription(description, prefix) {
    if (!description) return;

    // TYLKO tagi które są w formacie od Polsatu!
    const allowedTags = ['p', 'br', 'h2', 'strong', 'ul', 'li', 'ol'];
    const htmlTagPattern = /<\/?([a-z]+)(\s[^>]*)?>/gi;
    const matches = description.match(htmlTagPattern);

    if (matches) {
      matches.forEach(tag => {
        const tagName = tag.match(/<\/?([a-z]+)/i)?.[1]?.toLowerCase();
        if (tagName && !allowedTags.includes(tagName)) {
          this.errors.push(`${prefix}: Niedozwolony tag HTML: ${tag} (dozwolone: ${allowedTags.join(', ')})`);
        }
      });
    }

    // Sprawdzenie czy HTML jest poprawnie zamknięty
    const openTags = (description.match(/<[^\/][^>]*>/g) || []).length;
    const closeTags = (description.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (description.match(/<br\s*\/?>/gi) || []).length;

    if (openTags - selfClosingTags !== closeTags) {
      this.warnings.push(`${prefix}: Możliwe niezamknięte tagi HTML`);
    }
  }

  /**
   * Walidacja pól tablicowych
   */
  validateArrayFields(article, prefix) {
    if (article.sources) {
      if (article.sources.length === 0) {
        this.warnings.push(`${prefix}: Brak źródeł artykułu`);
      }
      
      article.sources.forEach((source, i) => {
        if (typeof source !== 'string') {
          this.errors.push(`${prefix}: Źródło [${i}] musi być tekstem`);
        }
      });
    }

    if (article.categories) {
      if (article.categories.length === 0) {
        this.warnings.push(`${prefix}: Brak kategorii artykułu`);
      }
      
      article.categories.forEach((category, i) => {
        if (typeof category !== 'string') {
          this.errors.push(`${prefix}: Kategoria [${i}] musi być tekstem`);
        }
      });
    }

    if (article.tags) {
      if (article.tags.length === 0) {
        this.warnings.push(`${prefix}: Brak tagów artykułu`);
      }
      
      if (article.tags.length > 10) {
        this.warnings.push(`${prefix}: Dużo tagów (${article.tags.length}), może warto ograniczyć`);
      }
      
      article.tags.forEach((tag, i) => {
        if (typeof tag !== 'string') {
          this.errors.push(`${prefix}: Tag [${i}] musi być tekstem`);
        }
      });
    }
  }

  /**
   * Zwraca wynik walidacji
   */
  getResult() {
    return {
      isValid: this.errors.length === 0,
      hasWarnings: this.warnings.length > 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length
      }
    };
  }

  /**
   * Formatuje wynik walidacji do czytelnego tekstu
   */
  formatReport(result) {
    let report = '';
    
    if (result.isValid) {
      report += '✅ JSON jest zgodny z formatem Polsatu\n';
    } else {
      report += '❌ JSON zawiera błędy:\n';
    }
    
    report += `📊 Podsumowanie: ${result.summary.totalErrors} błędów, ${result.summary.totalWarnings} ostrzeżeń\n\n`;
    
    if (result.errors.length > 0) {
      report += '🚨 BŁĘDY:\n';
      result.errors.forEach((error, i) => {
        report += `${i + 1}. ${error}\n`;
      });
      report += '\n';
    }
    
    if (result.warnings.length > 0) {
      report += '⚠️  OSTRZEŻENIA:\n';
      result.warnings.forEach((warning, i) => {
        report += `${i + 1}. ${warning}\n`;
      });
    }
    
    return report;
  }

  /**
   * Sprawdza pojedynczy plik JSON
   */
  static validateFile(filePath, fs) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const validator = new PolsatValidator();
      const result = validator.validate(fileContent);
      
      return {
        file: filePath,
        ...result
      };
    } catch (error) {
      return {
        file: filePath,
        isValid: false,
        hasWarnings: false,
        errors: [`Błąd odczytu pliku: ${error.message}`],
        warnings: [],
        summary: { totalErrors: 1, totalWarnings: 0 }
      };
    }
  }
}

module.exports = PolsatValidator;

// Użycie w Node.js:
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  
  // Przykład użycia z argumentami linii komend
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Użycie: node polsat-validator.js <ścieżka-do-pliku-json>');
    console.log('Przykład: node polsat-validator.js ../output/all-articles.json');
    process.exit(1);
  }
  
  const filePath = args[0];
  const validator = new PolsatValidator();
  const result = PolsatValidator.validateFile(filePath, fs);
  
  console.log(`\n📁 Sprawdzanie pliku: ${path.basename(filePath)}\n`);
  console.log(validator.formatReport(result));
  
  // Exit code: 0 jeśli valid, 1 jeśli błędy
  process.exit(result.isValid ? 0 : 1);
} 