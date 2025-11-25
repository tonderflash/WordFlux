/**
 * ParallelProcessor - Orquestador de Worker Threads
 * 
 * Este módulo gestiona un pool de worker threads para procesar
 * múltiples archivos en paralelo, maximizando el uso de CPU.
 * 
 * @module parallelProcessor
 */

const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const { objectToMap, mergeMaps, getTopWords } = require('./wordCounter');

/**
 * Obtiene timestamp formateado para logs
 * @returns {string} Timestamp en formato [YYYY-MM-DD HH:MM:SS]
 */
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Crea y ejecuta un worker para procesar un archivo
 * 
 * @param {string} filePath - Ruta del archivo a procesar
 * @param {number} workerId - ID del worker para logging
 * @returns {Promise<Object>} Resultado del procesamiento
 */
function createWorker(filePath, workerId) {
    return new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'worker.js');
        
        const worker = new Worker(workerPath, {
            workerData: {
                filePath,
                workerId
            }
        });

        worker.on('message', (message) => {
            // Mostrar mensajes de progreso
            if (message.type === 'progress') {
                console.log(message.message);
            }
            
            // Cuando el worker completa, resolver la promesa
            if (message.type === 'complete') {
                resolve(message);
            }
        });

        worker.on('error', (error) => {
            console.error(`[${getTimestamp()}] ❌ Worker ${workerId} error fatal: ${error.message}`);
            resolve({
                type: 'complete',
                workerId,
                filePath,
                success: false,
                error: {
                    message: error.message,
                    code: 'WORKER_ERROR'
                },
                message: `Worker ${workerId} crashed: ${error.message}`
            });
        });

        worker.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                console.error(`[${getTimestamp()}] ⚠️ Worker ${workerId} terminó con código ${code}`);
            }
        });
    });
}

/**
 * Procesa múltiples archivos en paralelo usando worker threads
 * 
 * @param {string[]} files - Array de rutas de archivos a procesar
 * @param {Object} options - Opciones de configuración
 * @param {number} options.maxWorkers - Máximo de workers simultáneos (default: CPUs disponibles)
 * @param {boolean} options.verbose - Mostrar logs detallados (default: true)
 * @returns {Promise<Object>} Resultados agregados de todos los archivos
 */
async function processFilesInParallel(files, options = {}) {
    // Manejar null explícitamente porque null no activa valores por defecto
    const maxWorkers = options.maxWorkers ?? os.cpus().length;
    const verbose = options.verbose ?? true;

    // Validación temprana - evitar división por cero y loops infinitos
    if (!files || files.length === 0) {
        if (verbose) {
            console.log('\n⚠️ No hay archivos para procesar.\n');
        }
        return {
            successful: [],
            failed: [],
            combinedWordMap: new Map(),
            totalWords: 0,
            totalUniqueWords: 0,
            totalLinesProcessed: 0
        };
    }

    const startTime = Date.now();
    const numCPUs = os.cpus().length;
    const effectiveWorkers = Math.max(1, Math.min(maxWorkers, files.length, numCPUs));

    if (verbose) {
        console.log('\n' + '═'.repeat(60));
        console.log('🚀 PROCESAMIENTO PARALELO CON WORKER THREADS');
        console.log('─'.repeat(60));
        console.log(`   CPUs disponibles:    ${numCPUs}`);
        console.log(`   Workers a usar:      ${effectiveWorkers}`);
        console.log(`   Archivos a procesar: ${files.length}`);
        console.log('═'.repeat(60) + '\n');
    }

    const results = {
        successful: [],
        failed: [],
        combinedWordMap: new Map(),
        totalWords: 0,
        totalUniqueWords: 0,
        totalLinesProcessed: 0
    };

    // Procesar archivos en batches del tamaño del pool de workers
    for (let i = 0; i < files.length; i += effectiveWorkers) {
        const batch = files.slice(i, i + effectiveWorkers);
        
        if (verbose && files.length > effectiveWorkers) {
            console.log(`\n[${getTimestamp()}] 📦 Procesando batch ${Math.floor(i / effectiveWorkers) + 1}/${Math.ceil(files.length / effectiveWorkers)}`);
        }

        // Crear workers para este batch en paralelo
        const batchPromises = batch.map((file, index) => 
            createWorker(file, i + index + 1)
        );

        // Esperar a que todos los workers del batch terminen
        const batchResults = await Promise.all(batchPromises);

        // Procesar resultados del batch
        for (const result of batchResults) {
            console.log(result.message);

            if (result.success) {
                results.successful.push({
                    filePath: result.filePath,
                    duration: result.duration,
                    uniqueWords: result.data.uniqueWords,
                    totalWords: result.data.totalWords,
                    linesProcessed: result.data.linesProcessed
                });

                // Convertir objeto de vuelta a Map y agregar a los totales
                const wordMap = objectToMap(result.data.wordMap);
                results.combinedWordMap = mergeMaps([results.combinedWordMap, wordMap]);
                results.totalWords += result.data.totalWords;
                results.totalLinesProcessed += result.data.linesProcessed;
            } else {
                results.failed.push({
                    filePath: result.filePath,
                    error: result.error
                });
            }
        }
    }

    results.totalUniqueWords = results.combinedWordMap.size;

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Mostrar resumen
    if (verbose) {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 RESUMEN DEL PROCESAMIENTO PARALELO');
        console.log('─'.repeat(60));
        console.log(`   Tiempo total:          ${totalDuration}s`);
        console.log(`   Archivos exitosos:     ${results.successful.length}`);
        console.log(`   Archivos fallidos:     ${results.failed.length}`);
        console.log(`   Líneas procesadas:     ${results.totalLinesProcessed.toLocaleString()}`);
        console.log(`   Total de palabras:     ${results.totalWords.toLocaleString()}`);
        console.log(`   Palabras únicas (combinadas): ${results.totalUniqueWords.toLocaleString()}`);
        
        if (results.failed.length > 0) {
            console.log('\n⚠️  ARCHIVOS CON ERRORES:');
            results.failed.forEach(f => {
                console.log(`   - ${f.filePath}: ${f.error.message}`);
            });
        }

        // Mostrar top 10 combinado
        if (results.combinedWordMap.size > 0) {
            const topWords = getTopWords(results.combinedWordMap, 10);
            console.log('\n🏆 TOP 10 PALABRAS MÁS FRECUENTES (COMBINADO):');
            console.log('─'.repeat(60));
            
            topWords.forEach((item, index) => {
                const rank = (index + 1).toString().padStart(2, ' ');
                const word = item.word.padEnd(20, ' ');
                const count = item.count.toLocaleString().padStart(12, ' ');
                const bar = '█'.repeat(Math.min(Math.floor(item.count / topWords[0].count * 20), 20));
                console.log(`   ${rank}. ${word} ${count}  ${bar}`);
            });
        }

        console.log('═'.repeat(60) + '\n');
    }

    return results;
}

module.exports = {
    processFilesInParallel,
    createWorker
};

