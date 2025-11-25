#!/usr/bin/env node

/**
 * WordFlux - Procesador de Archivos de Texto Grandes
 * 
 * CLI para contar palabras en archivos de texto usando streams
 * y worker threads para procesamiento paralelo.
 * 
 * Uso:
 *   node src/index.js <archivo>              - Procesar un archivo
 *   node src/index.js <archivo1> <archivo2>  - Procesar múltiples archivos
 *   node src/index.js <archivos> --parallel  - Usar worker threads
 *   node src/index.js --help                 - Mostrar ayuda
 * 
 * @module index
 */

const fs = require('fs');
const path = require('path');
const { countWords, formatResults } = require('./wordCounter');
const { processFilesInParallel } = require('./parallelProcessor');

/**
 * Obtiene timestamp formateado para logs
 * @returns {string} Timestamp en formato [YYYY-MM-DD HH:MM:SS]
 */
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Muestra la ayuda del programa
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     WORDFLUX v1.0.0                         ║
║        Procesador de Archivos de Texto Grandes              ║
╚══════════════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Cuenta palabras en archivos de texto grandes usando streams
  para eficiencia de memoria y worker threads para paralelización.

USO:
  node src/index.js [opciones] <archivo(s)>

OPCIONES:
  --help, -h        Muestra esta ayuda
  --parallel, -p    Usa worker threads para procesamiento paralelo
  --workers=N       Número máximo de workers (default: núcleos CPU)
  --quiet, -q       Modo silencioso (menos output)

EJEMPLOS:
  # Procesar un solo archivo
  node src/index.js data/libro.txt

  # Procesar múltiples archivos secuencialmente
  node src/index.js data/libro1.txt data/libro2.txt

  # Procesar múltiples archivos en paralelo
  node src/index.js data/*.txt --parallel

  # Limitar número de workers
  node src/index.js data/*.txt --parallel --workers=4

NOTAS:
  - El programa usa streams para manejar archivos de cualquier tamaño
  - Los archivos se procesan en UTF-8
  - Las palabras se normalizan a minúsculas
  - La puntuación se elimina antes del conteo
`);
}

/**
 * Parsea los argumentos de línea de comandos
 * @param {string[]} args - Argumentos de proceso
 * @returns {Object} Argumentos parseados
 */
function parseArgs(args) {
    const result = {
        files: [],
        parallel: false,
        workers: null,
        help: false,
        quiet: false
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (arg === '--parallel' || arg === '-p') {
            result.parallel = true;
        } else if (arg === '--quiet' || arg === '-q') {
            result.quiet = true;
        } else if (arg.startsWith('--workers=')) {
            result.workers = parseInt(arg.split('=')[1], 10);
        } else if (!arg.startsWith('-')) {
            // Es un archivo
            result.files.push(arg);
        }
    }

    return result;
}

/**
 * Expande patrones glob en archivos individuales
 * (Node.js no expande globs automáticamente en Windows)
 * @param {string[]} patterns - Patrones de archivos
 * @returns {string[]} Lista de archivos existentes
 */
function expandFiles(patterns) {
    const files = [];
    
    for (const pattern of patterns) {
        // Verificar si el archivo existe directamente
        if (fs.existsSync(pattern)) {
            const stats = fs.statSync(pattern);
            if (stats.isFile()) {
                files.push(path.resolve(pattern));
            } else if (stats.isDirectory()) {
                // Si es directorio, buscar archivos .txt dentro
                const dirFiles = fs.readdirSync(pattern)
                    .filter(f => f.endsWith('.txt'))
                    .map(f => path.resolve(pattern, f));
                files.push(...dirFiles);
            }
        } else {
            console.warn(`[${getTimestamp()}] ⚠️ Advertencia: '${pattern}' no encontrado`);
        }
    }

    return [...new Set(files)]; // Eliminar duplicados
}

/**
 * Procesa un solo archivo de forma secuencial
 * @param {string} filePath - Ruta del archivo
 * @param {boolean} quiet - Modo silencioso
 */
async function processSingleFile(filePath, quiet = false) {
    const startTime = Date.now();
    
    if (!quiet) {
        console.log(`\n[${getTimestamp()}] 🔄 Procesando: ${filePath}`);
    }

    try {
        const results = await countWords(filePath, {
            onProgress: quiet ? null : (progress) => {
                process.stdout.write(`\r[${getTimestamp()}] 📊 ${progress.linesProcessed.toLocaleString()} líneas procesadas...`);
            },
            progressInterval: 10000
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (!quiet) {
            process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Limpiar línea de progreso
            console.log(`[${getTimestamp()}] ✅ Completado en ${duration}s`);
        }

        console.log(formatResults(results, filePath));

        return { success: true, results };

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`\n[${getTimestamp()}] ❌ Error procesando ${filePath}: ${error.message}`);
        return { success: false, error };
    }
}

/**
 * Procesa múltiples archivos secuencialmente
 * @param {string[]} files - Lista de archivos
 * @param {boolean} quiet - Modo silencioso
 */
async function processFilesSequentially(files, quiet = false) {
    const startTime = Date.now();
    const results = {
        successful: 0,
        failed: 0,
        errors: []
    };

    console.log('\n' + '═'.repeat(60));
    console.log('📁 PROCESAMIENTO SECUENCIAL');
    console.log('─'.repeat(60));
    console.log(`   Archivos a procesar: ${files.length}`);
    console.log('═'.repeat(60));

    for (const file of files) {
        const result = await processSingleFile(file, quiet);
        if (result.success) {
            results.successful++;
        } else {
            results.failed++;
            results.errors.push({ file, error: result.error.message });
        }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('─'.repeat(60));
    console.log(`   Tiempo total:      ${totalDuration}s`);
    console.log(`   Archivos exitosos: ${results.successful}`);
    console.log(`   Archivos fallidos: ${results.failed}`);

    if (results.errors.length > 0) {
        console.log('\n⚠️  ERRORES:');
        results.errors.forEach(e => {
            console.log(`   - ${e.file}: ${e.error}`);
        });
    }

    console.log('═'.repeat(60) + '\n');
}

/**
 * Función principal
 */
async function main() {
    // Remover 'node' y el nombre del script de los argumentos
    const args = parseArgs(process.argv.slice(2));

    // Mostrar ayuda si se solicita o no hay argumentos
    if (args.help || args.files.length === 0) {
        showHelp();
        process.exit(args.help ? 0 : 1);
    }

    // Expandir archivos (manejar directorios)
    const files = expandFiles(args.files);

    if (files.length === 0) {
        console.error('❌ Error: No se encontraron archivos para procesar.');
        process.exit(1);
    }

    try {
        if (args.parallel && files.length > 1) {
            // Procesamiento paralelo con worker threads
            await processFilesInParallel(files, {
                maxWorkers: args.workers,
                verbose: !args.quiet
            });
        } else if (files.length === 1) {
            // Un solo archivo
            await processSingleFile(files[0], args.quiet);
        } else {
            // Múltiples archivos sin flag --parallel
            await processFilesSequentially(files, args.quiet);
        }
    } catch (error) {
        console.error(`\n❌ Error fatal: ${error.message}`);
        process.exit(1);
    }
}

// Ejecutar si es el módulo principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error no manejado:', error);
        process.exit(1);
    });
}

module.exports = { main, parseArgs, expandFiles };




