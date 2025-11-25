/**
 * WordCounter - Módulo de conteo de palabras usando streams
 * 
 * Este módulo procesa archivos de texto línea por línea usando streams,
 * lo que permite manejar archivos de cualquier tamaño sin agotar la memoria.
 * 
 * @module wordCounter
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

/**
 * Normaliza una línea de texto para extraer palabras limpias
 * 
 * @param {string} line - Línea de texto a procesar
 * @returns {string[]} Array de palabras normalizadas
 */
function normalizeLine(line) {
    return line
        .toLowerCase()
        // Remover puntuación pero mantener caracteres de palabra y acentos
        .replace(/[^\w\sáéíóúñüàèìòùâêîôûäëïöü]/gi, ' ')
        // Dividir por cualquier espacio en blanco
        .split(/\s+/)
        // Filtrar strings vacíos y palabras de un solo caracter (opcional)
        .filter(word => word.length > 0);
}

/**
 * Cuenta las palabras en un archivo de texto usando streams
 * 
 * @param {string} filePath - Ruta al archivo a procesar
 * @param {Object} options - Opciones de configuración
 * @param {Function} options.onProgress - Callback para reportar progreso (linesProcessed)
 * @param {number} options.progressInterval - Cada cuántas líneas reportar progreso (default: 10000)
 * @returns {Promise<{wordMap: Map, totalWords: number, uniqueWords: number, linesProcessed: number}>}
 */
async function countWords(filePath, options = {}) {
    const { onProgress, progressInterval = 10000 } = options;
    
    // Verificar que el archivo existe antes de procesar
    if (!fs.existsSync(filePath)) {
        throw new Error(`ENOENT: El archivo no existe: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
        throw new Error(`EISDIR: La ruta es un directorio, no un archivo: ${filePath}`);
    }

    const wordMap = new Map();
    let totalWords = 0;
    let linesProcessed = 0;

    // Crear stream de lectura con encoding UTF-8
    const fileStream = fs.createReadStream(filePath, { 
        encoding: 'utf8',
        // highWaterMark controla el tamaño del buffer interno (default 64KB)
        highWaterMark: 64 * 1024
    });

    // readline maneja automáticamente los saltos de línea y buffers parciales
    const rl = readline.createInterface({
        input: fileStream,
        // crlfDelay: Infinity trata \r\n como un solo salto de línea
        crlfDelay: Infinity
    });

    // Procesar línea por línea usando async iteration
    for await (const line of rl) {
        linesProcessed++;
        
        const words = normalizeLine(line);
        
        for (const word of words) {
            totalWords++;
            // Map.get() retorna undefined si la key no existe
            wordMap.set(word, (wordMap.get(word) || 0) + 1);
        }

        // Reportar progreso periódicamente si hay callback
        if (onProgress && linesProcessed % progressInterval === 0) {
            onProgress({
                linesProcessed,
                uniqueWords: wordMap.size,
                totalWords
            });
        }
    }

    return {
        wordMap,
        totalWords,
        uniqueWords: wordMap.size,
        linesProcessed
    };
}

/**
 * Obtiene las N palabras más frecuentes de un Map de conteos
 * 
 * @param {Map} wordMap - Map con palabras y sus conteos
 * @param {number} n - Cantidad de palabras a retornar (default: 10)
 * @returns {Array<{word: string, count: number}>} Array ordenado de mayor a menor
 */
function getTopWords(wordMap, n = 10) {
    // Convertir Map a array de [palabra, conteo] y ordenar
    return Array.from(wordMap.entries())
        .sort((a, b) => b[1] - a[1]) // Ordenar por conteo descendente
        .slice(0, n)
        .map(([word, count]) => ({ word, count }));
}

/**
 * Formatea los resultados para mostrar en consola
 * 
 * @param {Object} results - Resultados del conteo
 * @param {string} filePath - Ruta del archivo procesado
 * @returns {string} String formateado para imprimir
 */
function formatResults(results, filePath) {
    const { wordMap, totalWords, uniqueWords, linesProcessed } = results;
    const topWords = getTopWords(wordMap, 10);
    const fileName = path.basename(filePath);
    
    let output = '\n';
    output += '═'.repeat(60) + '\n';
    output += `📄 Archivo: ${fileName}\n`;
    output += '─'.repeat(60) + '\n';
    output += `   Líneas procesadas: ${linesProcessed.toLocaleString()}\n`;
    output += `   Total de palabras: ${totalWords.toLocaleString()}\n`;
    output += `   Palabras únicas:   ${uniqueWords.toLocaleString()}\n`;
    output += '─'.repeat(60) + '\n';
    output += '🏆 TOP 10 PALABRAS MÁS FRECUENTES:\n';
    output += '─'.repeat(60) + '\n';
    
    topWords.forEach((item, index) => {
        const rank = (index + 1).toString().padStart(2, ' ');
        const word = item.word.padEnd(20, ' ');
        const count = item.count.toLocaleString().padStart(10, ' ');
        const bar = '█'.repeat(Math.min(Math.floor(item.count / topWords[0].count * 20), 20));
        output += `   ${rank}. ${word} ${count}  ${bar}\n`;
    });
    
    output += '═'.repeat(60) + '\n';
    
    return output;
}

/**
 * Convierte un Map a un objeto serializable para transferir entre workers
 * 
 * @param {Map} wordMap - Map de palabras
 * @returns {Object} Objeto plano con los datos del Map
 */
function mapToObject(wordMap) {
    const obj = {};
    for (const [key, value] of wordMap) {
        obj[key] = value;
    }
    return obj;
}

/**
 * Convierte un objeto de vuelta a Map
 * 
 * @param {Object} obj - Objeto con pares palabra:conteo
 * @returns {Map} Map reconstruido
 */
function objectToMap(obj) {
    return new Map(Object.entries(obj));
}

/**
 * Combina múltiples Maps de conteo en uno solo
 * 
 * @param {Map[]} maps - Array de Maps a combinar
 * @returns {Map} Map combinado con conteos sumados
 */
function mergeMaps(maps) {
    const merged = new Map();
    
    for (const map of maps) {
        for (const [word, count] of map) {
            merged.set(word, (merged.get(word) || 0) + count);
        }
    }
    
    return merged;
}

module.exports = {
    countWords,
    getTopWords,
    formatResults,
    normalizeLine,
    mapToObject,
    objectToMap,
    mergeMaps
};

