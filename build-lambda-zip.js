#!/usr/bin/env node

/**
 * Script para crear el paquete ZIP para AWS Lambda
 * 
 * Este script crea un ZIP con todos los archivos necesarios
 * para desplegar WordFlux en Lambda.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ZIP_NAME = 'wordflux-lambda.zip';
const BUILD_DIR = path.join(__dirname, 'lambda-build');

console.log('📦 Creando paquete ZIP para AWS Lambda...\n');

// Limpiar directorio de build anterior
if (fs.existsSync(BUILD_DIR)) {
    console.log('🧹 Limpiando build anterior...');
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}

// Crear directorio de build
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Archivos a copiar
const filesToCopy = [
    'src/lambda.js',
    'src/wordCounter.js',
    'src/parallelProcessor.js',
    'src/worker.js',
    'package.json',
    'data'
];

console.log('📋 Copiando archivos necesarios...\n');

// Copiar archivos
filesToCopy.forEach(file => {
    const source = path.join(__dirname, file);
    const dest = path.join(BUILD_DIR, file);
    
    if (!fs.existsSync(source)) {
        console.error(`❌ Error: No se encuentra ${file}`);
        process.exit(1);
    }
    
    // Crear directorios necesarios para el destino
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    const stats = fs.statSync(source);
    if (stats.isDirectory()) {
        // Copiar directorio recursivamente
        fs.cpSync(source, dest, { recursive: true });
        console.log(`   ✅ ${file}/ (Directorio)`);
    } else {
        // Copiar archivo individual
        fs.copyFileSync(source, dest);
        console.log(`   ✅ ${file}`);
    }
});

// Crear ZIP
console.log(`\n📦 Creando ${ZIP_NAME}...`);

try {
    // Cambiar al directorio de build y crear ZIP
    const originalDir = process.cwd();
    process.chdir(BUILD_DIR);
    
    // Eliminar ZIP anterior si existe
    const zipPath = path.join(__dirname, ZIP_NAME);
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }
    
    // Usar zip si está disponible
    try {
        execSync(`zip -r ${zipPath} .`, { stdio: 'inherit' });
        console.log(`\n✅ ZIP creado exitosamente: ${zipPath}\n`);
    } catch (error) {
        // Si zip no está disponible, dar instrucciones
        console.log('\n⚠️  El comando "zip" no está disponible.');
        console.log('   Opciones:');
        console.log('   1. Instalar zip:');
        console.log('      macOS: brew install zip');
        console.log('      Linux: sudo apt-get install zip (Ubuntu/Debian)');
        console.log('      Windows: Usar PowerShell o 7-Zip');
        console.log('\n   2. Crear ZIP manualmente:');
        console.log(`      cd ${BUILD_DIR}`);
        console.log(`      zip -r ../${ZIP_NAME} .`);
        console.log('\n   3. O comprimir manualmente el contenido de:');
        console.log(`      ${BUILD_DIR}\n`);
        process.chdir(originalDir);
        process.exit(1);
    }
    
    // Volver al directorio original
    process.chdir(originalDir);
    
} catch (error) {
    console.error('❌ Error creando ZIP:', error.message);
    process.exit(1);
}

console.log('📝 Próximos pasos:');
console.log('   1. Ve a AWS Lambda Console');
console.log('   2. Crea una nueva función (Node.js 18.x)');
console.log('   3. Sube el archivo:', ZIP_NAME);
console.log('   4. Configura el handler: src/lambda.handler');
console.log('   5. Configura API Gateway como trigger\n');

