import mammoth from 'mammoth';

// Helper do parsowania DOCX w frontend (uproszczona wersja głównego parsera)
export class DocxParser {
  constructor() {
    this.defaultConfig = {
      author: "Redakcja",
      sources: ["red"],
      categories: ["Ciekawostki"]
    };
  }

  /**
   * Konwertuje buffer DOCX na HTML
   */
  async convertDocxToHtml(buffer) {
    try {
      const result = await mammoth.convertToHtml(buffer, {
        convertImage: mammoth.images.ignoreImage
      });
      
      return result.value;
    } catch (error) {
      throw new Error(`Błąd konwersji DOCX: ${error.message}`);
    }
  }

  /**
   * Parsuje dokument HTML na strukturę artykułu
   */
  parseDocument(html, filename = '') {
    // LOGUJ HTML PO MAMMOTH
    console.log('--- DOCX PARSER DEBUG ---');
    console.log('HTML po mammoth:', html.substring(0, 1000) + (html.length > 1000 ? '... [obcięto]' : ''));

    // Wyciągnij wszystkie elementy
    const headers = this.extractHeaders(html);
    const paragraphs = this.extractParagraphs(html);

    // LOGUJ WSZYSTKIE AKAPITY
    console.log('Akapity:', paragraphs);

    // Usuń puste paragrafy
    const cleanParagraphs = paragraphs.filter(p => p.trim() !== '');
    
    let title = '';
    let lead = '';
    let leadIndex = -1;

    if (headers.length > 0) {
      // Pierwszy nagłówek to tytuł
      title = headers[0];
    }

    // Szukaj leadu: pierwszy długi akapit, który nie jest tytułem
    for (let i = 0; i < cleanParagraphs.length; i++) {
      const p = cleanParagraphs[i];
      if (
        p.length > 100 &&
        p !== title &&
        !isSimilar(p, title)
      ) {
        lead = p;
        leadIndex = i;
        break;
      }
    }

    // Nowa logika: description to oryginalny HTML po mammoth, z usuniętym tytułem i leadem
    let description = html;

    // Usuń nagłówek H1 z tytułem (cały tag)
    if (title) {
      const titleHeaderRegex = new RegExp(`<h[1-6][^>]*>\\s*${escapeRegex(title)}\\s*</h[1-6]>`, 'i');
      description = description.replace(titleHeaderRegex, '').trim();
    }

    // Usuń akapit z tytułem
    if (title) {
      const titleParagraphRegex = new RegExp(`<p[^>]*>\\s*${escapeRegex(title)}\\s*</p>`, 'i');
      description = description.replace(titleParagraphRegex, '').trim();
    }

    // Usuń akapit z leadem
    if (lead) {
      const leadParagraphRegex = new RegExp(`<p[^>]*>\\s*${escapeRegex(lead)}\\s*</p>`, 'i');
      description = description.replace(leadParagraphRegex, '').trim();
    }

    // Formatowanie HTML (opcjonalnie)
    description = description.replace(/<\/h([1-6])>/g, '</h$1>');

    // Czyszczenie niechcianych tagów HTML
    description = this.cleanUnwantedHtmlTags(description);

    // USUŃ każdy <h1> bardzo podobny do tytułu
    description = description.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (match, h1text) => isSimilar(h1text, title) ? '' : match);

    // Usuń puste akapity (np. <p></p>, <p> </p>, <p>&nbsp;</p>)
    description = description.replace(/<p>(\s|&nbsp;)*<\/p>/gi, '');

    // OSTRZEŻENIE jeśli lead == tytuł
    if (lead && lead.trim() === title.trim()) {
      console.warn('⚠️  LEAD JEST IDENTYCZNY Z TYTUŁEM!');
      console.warn('Tytuł:', title);
      console.warn('Lead:', lead);
      console.warn('Pierwsze 3 akapity:', cleanParagraphs.slice(0, 3));
    }

    return {
      title: title || this.generateTitleFromFilename(filename),
      description: description || '',
      lead: lead || ''
    };
  }

  /**
   * Usuwa niechciane tagi HTML (kotwice, obrazy, itp.)
   */
  cleanUnwantedHtmlTags(html) {
    let cleaned = html;
    
    // Usuń wszystkie tagi <a> (kotwice i linki)
    // Usuwamy zarówno <a id="..."></a> jak i <a href="...">tekst</a>
    cleaned = cleaned.replace(/<a[^>]*>.*?<\/a>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*>/gi, ''); // samozamykające się
    
    // Usuń wszystkie tagi <img> (obrazy z base64 i inne)
    cleaned = cleaned.replace(/<img[^>]*\/?>/gi, '');
    
    // Usuń puste akapity powstałe po usunięciu tagów
    cleaned = cleaned.replace(/<p>(\s|&nbsp;)*<\/p>/gi, '');
    
    // Usuń wielokrotne spacje i przejścia do nowej linii
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/>\s+</g, '><');
    
    return cleaned.trim();
  }

  /**
   * Wyciąga nagłówki z HTML
   */
  extractHeaders(html) {
    const headerRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
    const headers = [];
    let match;
    
    while ((match = headerRegex.exec(html)) !== null) {
      const headerText = match[1]
        .replace(/<[^>]*>/g, '') // Usuń tagi HTML
        .replace(/&nbsp;/g, ' ') // Zamień &nbsp; na spacje
        .trim();
      
      if (headerText) {
        headers.push(headerText);
      }
    }
    
    return headers;
  }

  /**
   * Wyciąga paragrafy z HTML
   */
  extractParagraphs(html) {
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
    const paragraphs = [];
    let match;
    
    while ((match = paragraphRegex.exec(html)) !== null) {
      const paragraphText = match[1]
        .replace(/<[^>]*>/g, '') // Usuń tagi HTML
        .replace(/&nbsp;/g, ' ') // Zamień &nbsp; na spacje
        .trim();
      
      if (paragraphText) {
        paragraphs.push(paragraphText);
      }
    }
    
    return paragraphs;
  }

  /**
   * Generuje tytuł z nazwy pliku
   */
  generateTitleFromFilename(filename) {
    if (!filename) return 'Bez tytułu';
    
    return filename
      .replace(/\.[^/.]+$/, '') // Usuń rozszerzenie
      .replace(/[_-]/g, ' ') // Zamień _ i - na spacje
      .replace(/\s+/g, ' ') // Usuń wielokrotne spacje
      .trim();
  }

  /**
   * Konwertuje plik DOCX na artykuł JSON
   */
  async convertToArticle(buffer, filename, articlePath = '') {
    try {
      const html = await this.convertDocxToHtml(buffer);
      const parsed = this.parseDocument(html, filename);
      
      // Generuj ID artykułu
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 5);
      const articleId = `ART${timestamp}_${randomId}`;
      
      // Przygotuj dane artykułu
      const article = {
        articleId,
        title: parsed.title,
        titleHotnews: '', // Zostanie wygenerowane przez AI
        titleSocial: '', // Zostanie wygenerowane przez AI
        titleSeo: '', // Zostanie wygenerowane przez AI
        lead: parsed.lead,
        description: parsed.description,
        author: this.defaultConfig.author,
        sources: this.defaultConfig.sources,
        categories: this.defaultConfig.categories,
        tags: [], // Zostaną wygenerowane przez AI
        status: 'draft',
        imported_from: 'google_drive',
        drive_path: articlePath,
        original_filename: filename
      };
      
      return article;
    } catch (error) {
      throw new Error(`Błąd konwersji: ${error.message}`);
    }
  }
}

// Funkcja pomocnicza do porównywania podobieństwa tekstów
function isSimilar(a, b) {
  if (!a || !b) return false;
  a = a.trim().toLowerCase();
  b = b.trim().toLowerCase();
  if (a.length === 0 || b.length === 0) return false;
  const minLen = Math.min(a.length, b.length);
  let same = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) same++;
  }
  return (same / minLen) > 0.8;
}

// Funkcja pomocnicza do escapowania tekstu do regexa
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
} 