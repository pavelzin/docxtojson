#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const { program } = require('commander');
const chalk = require('chalk');
require('dotenv').config();

class DocxToJsonConverter {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.defaultConfig = {
            author: "Redakcja",
            sources: ["red"],
            categories: ["Ciekawostki"]
        };
    }

    /**
     * Konwertuje plik DOCX na HTML
     */
    async convertDocxToHtml(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            const result = await mammoth.convertToHtml(buffer, {
                convertImage: mammoth.images.ignoreImage
            });
            
            if (result.messages.length > 0) {
                console.log(chalk.yellow('Ostrzeżenia podczas konwersji:'));
                result.messages.forEach(msg => console.log(chalk.yellow(`  - ${msg.message}`)));
            }
            
            return result.value;
        } catch (error) {
            throw new Error(`Błąd konwersji DOCX: ${error.message}`);
        }
    }

    /**
     * Uniwersalny parser dokumentu - obsługuje różne struktury DOCX
     */
    parseDocument(html, filename = '') {
        // Wyciągnij wszystkie elementy
        const headers = this.extractHeaders(html);
        const paragraphs = this.extractParagraphs(html);
        
        // Strategia wyciągania tytułu (w kolejności priorytetów)
        const title = this.findTitle(headers, paragraphs, filename);
        
        // Strategia wyciągania lead'a (pomijając tytuł)
        const lead = this.findLead(paragraphs, title);
        
        // Przygotuj description (usuń tytuł i lead)
        const description = this.prepareCleanDescription(html, title, lead, headers);
        
        return { title, lead, description };
    }

    /**
     * Wyciąga wszystkie nagłówki H1-H6
     */
    extractHeaders(html) {
        const headers = [];
        for (let level = 1; level <= 6; level++) {
            const regex = new RegExp(`<h${level}[^>]*>(.*?)</h${level}>`, 'gi');
            let match;
            while ((match = regex.exec(html)) !== null) {
                headers.push({
                    level,
                    tag: match[0],
                    text: match[1].replace(/<[^>]*>/g, '').trim(),
                    originalMatch: match[0]
                });
            }
        }
        return headers.sort((a, b) => {
            // Sortuj według pozycji w dokumencie
            return html.indexOf(a.originalMatch) - html.indexOf(b.originalMatch);
        });
    }

    /**
     * Wyciąga wszystkie akapity
     */
    extractParagraphs(html) {
        const paragraphMatches = html.match(/<p[^>]*>(.*?)<\/p>/g) || [];
        return paragraphMatches.map(p => ({
            tag: p,
            text: p.replace(/<[^>]*>/g, '').trim(),
            length: p.replace(/<[^>]*>/g, '').trim().length
        }));
    }

    /**
     * Inteligentne wykrywanie tytułu (priorytet: H1 → krótki <p> → nazwa pliku)
     */
    findTitle(headers, paragraphs, filename = '') {
        // 1. Sprawdź pierwszy H1 (najwyższy priorytet)
        const firstH1 = headers.find(h => h.level === 1);
        if (firstH1 && firstH1.text.length > 10 && firstH1.text.length < 200) {
            return firstH1.text;
        }
        
        // 2. Sprawdź pierwszy krótki akapit (20-150 znaków)
        const shortParagraph = paragraphs.find(p => 
            p.length >= 20 && p.length <= 150
        );
        if (shortParagraph) {
            return shortParagraph.text;
        }
        
        // 3. Sprawdź pierwszy H2 jeśli nie ma H1
        const firstH2 = headers.find(h => h.level === 2);
        if (firstH2 && firstH2.text.length > 10 && firstH2.text.length < 200) {
            return firstH2.text;
        }
        
        // 4. Fallback - nazwa pliku (bez rozszerzenia)
        if (filename) {
            return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        }
        
        return '';
    }

    /**
     * Inteligentne wykrywanie lead'a (pierwszy długi akapit, nie będący tytułem)
     */
    findLead(paragraphs, title) {
        return paragraphs.find(p => {
            // Lead musi być długi (min 100 znaków)
            if (p.length < 100) return false;
            
            // Lead nie może być identyczny z tytułem
            if (title && p.text === title) return false;
            
            // Lead nie może być bardzo podobny do tytułu (podobieństwo > 80%)
            if (title && this.calculateSimilarity(p.text, title) > 0.8) return false;
            
            return true;
        })?.text || '';
    }

    /**
     * Oblicza podobieństwo tekstów (0-1)
     */
    calculateSimilarity(text1, text2) {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        return commonWords.length / Math.max(words1.length, words2.length);
    }

    /**
     * Przygotowuje czysty opis (usuwa tytuł, lead i duplikaty nagłówków)
     */
    prepareCleanDescription(html, title, lead, headers) {
        let description = html;
        
        // Usuń nagłówek H1 z tytułem (cały tag)
        if (title) {
            const titleHeader = headers.find(h => h.text === title);
            if (titleHeader) {
                description = description.replace(titleHeader.originalMatch, '').trim();
            }
        }
        
        // Usuń akapit z tytułem
        if (title) {
            const titleRegex = new RegExp(`<p[^>]*>\\s*${this.escapeRegex(title)}\\s*</p>`, 'i');
            description = description.replace(titleRegex, '').trim();
        }
        
        // Usuń akapit z lead'em
        if (lead) {
            const leadRegex = new RegExp(`<p[^>]*>\\s*${this.escapeRegex(lead)}\\s*</p>`, 'i');
            description = description.replace(leadRegex, '').trim();
        }
        
        // Formatowanie HTML
        description = description.replace(/<\/p>\s*<p/g, '</p><br><p');
        description = description.replace(/<\/h([1-6])>/g, '</h$1><br>');
        
        return description;
    }

    /**
     * Escapuje znaki specjalne dla regex
     */
    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Przygotowuje opis z formatowaniem HTML (bez tytułu i lead'a)
     */
    prepareDescription(html, lead, title) {
        let description = html;
        
        // Usuń tytuł H1 jeśli istnieje (cały tag z zawartością)
        if (title) {
            // Usuń cały tag H1 który zawiera tytuł (może mieć inne elementy wewnątrz)
            const h1Regex = /<h1[^>]*>.*?<\/h1>/i;
            description = description.replace(h1Regex, '').trim();
        }
        
        // Znajdź wszystkie akapity
        const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/g);
        
        if (paragraphs && paragraphs.length > 0) {
            // Usuń pierwszy akapit (tytuł) - jeśli jest krótki
            const firstParagraph = paragraphs[0];
            const firstText = firstParagraph.replace(/<[^>]*>/g, '').trim();
            
            if (firstText.length < 100) {
                // To jest tytuł, usuń go
                const titleRegex = new RegExp(`<p[^>]*>\\s*${firstText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`, 'i');
                description = description.replace(titleRegex, '').trim();
            }
        }
        
        // Usuń lead z opisu
        if (lead) {
            const leadRegex = new RegExp(`<p[^>]*>\\s*${lead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`, 'i');
            description = description.replace(leadRegex, '').trim();
        }
        
        // Zamień </p><p> na </p><br><p> dla lepszego formatowania
        description = description.replace(/<\/p>\s*<p/g, '</p><br><p');
        
        // Dodaj <br> po nagłówkach
        description = description.replace(/<\/h([1-6])>/g, '</h$1><br>');
        
        return description;
    }

    /**
     * Wyciąga tytuł z HTML (sprawdza H1, potem pierwszy krótki akapit)
     */
    extractTitle(html) {
        // Sprawdź najpierw czy jest tag H1
        const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
        if (h1Match) {
            const h1Text = h1Match[1].replace(/<[^>]*>/g, '').trim();
            if (h1Text.length > 10) { // Sprawdź czy nie jest pusty
                return h1Text;
            }
        }
        
        // Jeśli nie ma H1 lub jest pusty, sprawdź pierwszy akapit
        const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/g);
        
        if (paragraphs && paragraphs.length > 0) {
            const firstText = paragraphs[0].replace(/<[^>]*>/g, '').trim();
            
            // Pierwszy akapit to tytuł jeśli jest krótki
            if (firstText.length < 100) {
                return firstText;
            }
        }
        
        return '';
    }

    /**
     * Generuje pola przez LLM na podstawie titleSocial (bez title - ten jest z artykułu)
     */
    async generateFields(titleSocial, lead, description) {
        const prompt = `
Na podstawie poniższych danych artykułu, wygeneruj następujące pola:

TITLE SOCIAL (dostarczony): "${titleSocial}"
LEAD: "${lead}"
TREŚĆ: "${description.replace(/<[^>]*>/g, '').substring(0, 500)}..."

Wygeneruj:
1. titleHotnews - skrócony tytuł do maksymalnie 50 znaków na podstawie titleSocial
2. titleSeo - tytuł SEO ze słowami kluczowymi (60-80 znaków)
3. tags - dokładnie 5 tagów oddzielonych przecinkami
4. categories - 1-2 kategorie oddzielone przecinkami

Odpowiedz tylko w formacie JSON:
{
  "titleHotnews": "...",
  "titleSeo": "...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "categories": ["kategoria1"]
}
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "Jesteś ekspertem SEO i content marketingu. Generujesz tytuły i tagi dla polskich artykułów internetowych."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            let content = response.choices[0].message.content;
            
            // Usuń bloki kodu jeśli LLM zwrócił JSON w ```json
            content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Błąd generowania pól przez LLM: ${error.message}`);
        }
    }

    /**
     * Generuje titleSocial na podstawie nazwy pliku i treści
     */
    generateTitleSocial(filename, lead) {
        // Usuń rozszerzenie i zamień - oraz _ na spacje
        let title = path.parse(filename).name
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        
        // Jeśli mamy lead, użyj go jako bazy
        if (lead && lead.length > 20) {
            title = lead.substring(0, 100) + (lead.length > 100 ? '...' : '');
        }
        
        // Dodaj emocjonalny element
        const emotions = [
            'Sprawdź co się stanie!',
            'Nie uwierzysz co się dzieje!',
            'To musisz zobaczyć!',
            'Eksperci są w szoku!',
            'Dowiedz się więcej!',
            'Zobacz jak to zrobić!'
        ];
        
        const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        return `${title} - ${randomEmotion}`;
    }

    /**
     * Skanuje katalog w poszukiwaniu plików DOCX
     */
    async scanDirectory(dirPath) {
        try {
            const files = await fs.readdir(dirPath);
            return files.filter(file => 
                file.toLowerCase().endsWith('.docx') && 
                !file.startsWith('~$') // Pomiń tymczasowe pliki Word
            );
        } catch (error) {
            throw new Error(`Błąd odczytu katalogu ${dirPath}: ${error.message}`);
        }
    }

    /**
     * Przetwarza jeden plik DOCX
     */
    async processFile(filePath, titleSocial, customArticleId = null) {
        console.log(chalk.blue(`\nPrzetwarzam: ${path.basename(filePath)}`));
        
        try {
            // 1. Konwertuj DOCX na HTML
            const html = await this.convertDocxToHtml(filePath);
            
            // 2. Parsuj dokument uniwersalnie
            const { title, lead, description } = this.parseDocument(html, path.basename(filePath));
            
            // 3. Jeśli nie ma titleSocial, wygeneruj na podstawie pliku
            if (!titleSocial) {
                titleSocial = this.generateTitleSocial(path.basename(filePath), lead);
            }
            
            // 4. Wygeneruj pola przez LLM (bez title)
            console.log(chalk.gray('Generuję pola przez LLM...'));
            const generatedFields = await this.generateFields(titleSocial, lead, description);
            
            // 5. Stwórz obiekt artykułu
            const articleId = customArticleId || `ART${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            const article = {
                articleId,
                title, // Tytuł z artykułu (uniwersalny parser)
                titleHotnews: generatedFields.titleHotnews,
                titleSocial,
                titleSeo: generatedFields.titleSeo,
                lead, // Lead z artykułu (uniwersalny parser)
                description, // Opis bez tytułu i lead'a
                author: this.defaultConfig.author,
                sources: this.defaultConfig.sources,
                categories: generatedFields.categories || this.defaultConfig.categories,
                tags: generatedFields.tags
            };
            
            console.log(chalk.green(`✓ Przetworzono pomyślnie`));
            console.log(chalk.gray(`  Title: ${article.title}`));
            console.log(chalk.gray(`  Lead: ${article.lead.substring(0, 80)}...`));
            console.log(chalk.gray(`  Tags: ${article.tags.join(', ')}`));
            
            return article;
            
        } catch (error) {
            console.log(chalk.red(`✗ Błąd przetwarzania: ${error.message}`));
            throw error;
        }
    }

    /**
     * Przetwarza wiele plików i tworzy JSON
     */
    async processFiles(fileConfigs, outputPath) {
        const articles = [];
        
        for (const config of fileConfigs) {
            try {
                const article = await this.processFile(
                    config.filePath, 
                    config.titleSocial, 
                    config.articleId
                );
                articles.push(article);
            } catch (error) {
                console.log(chalk.red(`Pomijam plik ${config.filePath}: ${error.message}`));
            }
        }
        
        const result = { articles };
        
        // Zapisz wynik
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
        
        console.log(chalk.green(`\n✓ Wygenerowano JSON: ${outputPath}`));
        console.log(chalk.green(`✓ Przetworzone artykuły: ${articles.length}`));
        
        return result;
    }

    /**
     * Batch processing - skanuje input/ i konwertuje do output/
     */
    async processBatch(inputDir = './input', outputDir = './output') {
        console.log(chalk.blue(`🔍 Skanowanie katalogu: ${inputDir}`));
        
        try {
            // Sprawdź czy katalogi istnieją
            await fs.access(inputDir);
            await fs.mkdir(outputDir, { recursive: true });
            
            // Znajdź wszystkie pliki DOCX
            const docxFiles = await this.scanDirectory(inputDir);
            
            if (docxFiles.length === 0) {
                console.log(chalk.yellow(`Nie znaleziono plików DOCX w katalogu ${inputDir}`));
                return;
            }
            
            console.log(chalk.green(`📄 Znaleziono ${docxFiles.length} plików DOCX:`));
            docxFiles.forEach(file => console.log(chalk.gray(`  - ${file}`)));
            
            let processedCount = 0;
            const results = [];
            
            // Przetwórz każdy plik
            for (const filename of docxFiles) {
                const filePath = path.join(inputDir, filename);
                const baseName = path.parse(filename).name;
                const outputPath = path.join(outputDir, `${baseName}.json`);
                
                try {
                    console.log(chalk.blue(`\n📝 Przetwarzam: ${filename}`));
                    
                    const article = await this.processFile(filePath);
                    
                    // Zapisz pojedynczy artykuł do JSON
                    const singleArticleResult = { articles: [article] };
                    await fs.writeFile(outputPath, JSON.stringify(singleArticleResult, null, 2), 'utf8');
                    
                    results.push(article);
                    processedCount++;
                    
                    console.log(chalk.green(`✅ Zapisano: ${outputPath}`));
                    
                } catch (error) {
                    console.log(chalk.red(`❌ Błąd przetwarzania ${filename}: ${error.message}`));
                }
            }
            
            // Zapisz też zbiorczy plik ze wszystkimi artykułami
            if (results.length > 0) {
                const allArticlesPath = path.join(outputDir, 'all-articles.json');
                const allArticlesResult = { articles: results };
                await fs.writeFile(allArticlesPath, JSON.stringify(allArticlesResult, null, 2), 'utf8');
                
                console.log(chalk.green(`\n🎉 GOTOWE!`));
                console.log(chalk.green(`📊 Przetworzono: ${processedCount}/${docxFiles.length} plików`));
                console.log(chalk.green(`📁 Pojedyncze JSON-y: ${outputDir}/`));
                console.log(chalk.green(`📄 Zbiorczy plik: ${allArticlesPath}`));
            }
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(chalk.red(`❌ Katalog ${inputDir} nie istnieje. Utwórz go i dodaj pliki DOCX.`));
            } else {
                console.log(chalk.red(`❌ Błąd batch processing: ${error.message}`));
            }
        }
    }
}

// CLI
program
    .name('docx-to-json')
    .description('Konwerter DOCX na JSON dla Polsat News')
    .version('1.0.0');

program
    .command('convert')
    .description('Konwertuj pliki DOCX na JSON')
    .option('-f, --file <path>', 'Ścieżka do pliku DOCX')
    .option('-d, --dir <path>', 'Katalog z plikami DOCX')
    .option('-o, --output <path>', 'Plik wyjściowy JSON', 'output.json')
    .option('-t, --title <title>', 'Title Social dla pojedynczego pliku')
    .option('-c, --config <path>', 'Plik konfiguracyjny JSON')
    .action(async (options) => {
        try {
            const converter = new DocxToJsonConverter();
            
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('Brak OPENAI_API_KEY w pliku .env - ustaw swój klucz API');
            }
            
            let fileConfigs = [];
            
            if (options.config) {
                // Wczytaj konfigurację z pliku
                const configData = await fs.readFile(options.config, 'utf8');
                const config = JSON.parse(configData);
                fileConfigs = config.files;
            } else if (options.file) {
                // Pojedynczy plik
                if (!options.title) {
                    throw new Error('Musisz podać --title dla pojedynczego pliku');
                }
                fileConfigs = [{
                    filePath: options.file,
                    titleSocial: options.title,
                    articleId: null
                }];
            } else if (options.dir) {
                throw new Error('Opcja --dir wymaga pliku konfiguracyjnego z titleSocial dla każdego pliku');
            } else {
                throw new Error('Musisz podać --file, --dir lub --config');
            }
            
            await converter.processFiles(fileConfigs, options.output);
            
        } catch (error) {
            console.log(chalk.red(`Błąd: ${error.message}`));
            process.exit(1);
        }
    });

// Nowa komenda batch
program
    .command('batch')
    .description('Automatycznie konwertuj wszystkie pliki DOCX z input/ do output/')
    .option('-i, --input <path>', 'Katalog wejściowy z plikami DOCX', './input')
    .option('-o, --output <path>', 'Katalog wyjściowy dla JSON-ów', './output')
    .action(async (options) => {
        try {
            const converter = new DocxToJsonConverter();
            
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('Brak OPENAI_API_KEY w pliku .env - ustaw swój klucz API');
            }
            
            await converter.processBatch(options.input, options.output);
            
        } catch (error) {
            console.log(chalk.red(`❌ Błąd: ${error.message}`));
            process.exit(1);
        }
    });

program.parse();