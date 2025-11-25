/**
 * Worker Thread para procesamiento paralelo de archivos
 * 
 * Este módulo se ejecuta en un thread separado y procesa un archivo
 * individual, enviando los resultados al proceso principal.
 * 
 * @module worker
 */

const { parentPort, workerData } = require('worker_threads');
const { countWords, mapToObject } = require('./wordCounter');

/**
 * Obtiene timestamp formateado para logs
 * @returns {string} Timestamp en formato [YYYY-MM-DD HH:MM:SS]
 */
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Procesa el archivo asignado a este worker
 */
async function processFile() {
    const { filePath, workerId } = workerData;
    
    const startTime = Date.now();
    
    try {
        // Notificar inicio del procesamiento
        parentPort.postMessage({
            type: 'progress',
            workerId,
            filePath,
            message: `[${getTimestamp()}] 🔄 Worker ${workerId}: Iniciando procesamiento de ${filePath}`
        });

        // Procesar el archivo con callback de progreso
        const results = await countWords(filePath, {
            onProgress: (progress) => {
                parentPort.postMessage({
                    type: 'progress',
                    workerId,
                    filePath,
                    message: `[${getTimestamp()}] 📊 Worker ${workerId}: ${progress.linesProcessed.toLocaleString()} líneas procesadas...`
                });
            },
            progressInterval: 50000 // Reportar cada 50,000 líneas
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // Enviar resultados al proceso principal
        // Nota: Map no se puede serializar directamente, convertimos a objeto
        parentPort.postMessage({
            type: 'complete',
            workerId,
            filePath,
            success: true,
            duration,
            data: {
                wordMap: mapToObject(results.wordMap),
                totalWords: results.totalWords,
                uniqueWords: results.uniqueWords,
                linesProcessed: results.linesProcessed
            },
            message: `[${getTimestamp()}] ✅ Worker ${workerId}: Completado ${filePath} en ${duration}s (${results.uniqueWords.toLocaleString()} palabras únicas)`
        });

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Enviar error al proceso principal
        parentPort.postMessage({
            type: 'complete',
            workerId,
            filePath,
            success: false,
            duration,
            error: {
                message: error.message,
                code: error.code || 'UNKNOWN'
            },
            message: `[${getTimestamp()}] ❌ Worker ${workerId}: Error en ${filePath} - ${error.message}`
        });
    }
}

// Iniciar procesamiento cuando el worker arranca
processFile();




