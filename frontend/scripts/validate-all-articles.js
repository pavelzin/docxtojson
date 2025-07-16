#!/usr/bin/env node

/**
 * Skrypt do walidacji wszystkich plików JSON w katalogu output/
 * Sprawdza zgodność z formatem Polsatu
 */

const fs = require('fs');
const path = require('path');
const PolsatValidator = require('../lib/polsat-validator.js');

function validateAllArticles() {
  console.log('🔍 Walidacja wszystkich artykułów JSON...\n');
  
  // Ścieżki do sprawdzenia
  const outputDir = path.join(__dirname, '../../output');
  const frontendOutputDir = path.join(__dirname, '../output');
  
  let outputPath;
  if (fs.existsSync(outputDir)) {
    outputPath = outputDir;
  } else if (fs.existsSync(frontendOutputDir)) {
    outputPath = frontendOutputDir;
  } else {
    console.error('❌ Nie znaleziono katalogu output/');
    console.log('Sprawdzane ścieżki:');
    console.log(`- ${outputDir}`);
    console.log(`- ${frontendOutputDir}`);
    process.exit(1);
  }
  
  console.log(`📁 Sprawdzanie katalogu: ${outputPath}\n`);
  
  // Znajdź wszystkie pliki JSON
  let jsonFiles;
  try {
    const allFiles = fs.readdirSync(outputPath);
    jsonFiles = allFiles.filter(file => file.endsWith('.json'));
  } catch (error) {
    console.error(`❌ Błąd odczytu katalogu: ${error.message}`);
    process.exit(1);
  }
  
  if (jsonFiles.length === 0) {
    console.log('⚠️  Brak plików JSON do sprawdzenia');
    return;
  }
  
  console.log(`📄 Znaleziono ${jsonFiles.length} plików JSON:\n`);
  
  const results = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // Waliduj każdy plik
  jsonFiles.forEach(fileName => {
    const filePath = path.join(outputPath, fileName);
    const validator = new PolsatValidator();
    const result = PolsatValidator.validateFile(filePath, fs);
    
    results.push({ fileName, ...result });
    totalErrors += result.summary.totalErrors;
    totalWarnings += result.summary.totalWarnings;
    
    // Wyświetl rezultat dla pliku
    const status = result.isValid ? '✅' : '❌';
    const warningInfo = result.hasWarnings ? ` (${result.summary.totalWarnings} ostrzeżeń)` : '';
    
    console.log(`${status} ${fileName}${warningInfo}`);
    
    // Pokaż błędy jeśli są
    if (result.errors.length > 0) {
      console.log(`   🚨 Błędy:`);
      result.errors.forEach(error => {
        console.log(`      - ${error}`);
      });
    }
    
    // Pokaż ostrzeżenia jeśli są (ale tylko pierwsze 3)
    if (result.warnings.length > 0) {
      console.log(`   ⚠️  Ostrzeżenia:`);
      result.warnings.slice(0, 3).forEach(warning => {
        console.log(`      - ${warning}`);
      });
      if (result.warnings.length > 3) {
        console.log(`      ... i ${result.warnings.length - 3} więcej`);
      }
    }
    
    console.log('');
  });
  
  // Podsumowanie końcowe
  console.log('═'.repeat(60));
  console.log('📊 PODSUMOWANIE WALIDACJI');
  console.log('═'.repeat(60));
  
  const validFiles = results.filter(r => r.isValid).length;
  const invalidFiles = results.filter(r => !r.isValid).length;
  const filesWithWarnings = results.filter(r => r.hasWarnings).length;
  
  console.log(`📁 Sprawdzonych plików: ${results.length}`);
  console.log(`✅ Poprawnych: ${validFiles}`);
  console.log(`❌ Z błędami: ${invalidFiles}`);
  console.log(`⚠️  Z ostrzeżeniami: ${filesWithWarnings}`);
  console.log(`🚨 Łączna liczba błędów: ${totalErrors}`);
  console.log(`⚠️  Łączna liczba ostrzeżeń: ${totalWarnings}`);
  
  if (invalidFiles === 0) {
    console.log('\n🎉 Wszystkie pliki są zgodne z formatem Polsatu!');
  } else {
    console.log(`\n⚠️  ${invalidFiles} plików wymaga poprawek`);
  }
  
  // Szczegółowy raport dla problematycznych plików
  const problematicFiles = results.filter(r => !r.isValid);
  if (problematicFiles.length > 0) {
    console.log('\n' + '═'.repeat(60));
    console.log('🔍 SZCZEGÓŁOWE BŁĘDY');
    console.log('═'.repeat(60));
    
    problematicFiles.forEach(result => {
      console.log(`\n📄 ${result.fileName}:`);
      const validator = new PolsatValidator();
      console.log(validator.formatReport(result));
    });
  }
  
  // Exit code
  process.exit(invalidFiles > 0 ? 1 : 0);
}

// Uruchom walidację
if (require.main === module) {
  validateAllArticles();
}

module.exports = validateAllArticles; 