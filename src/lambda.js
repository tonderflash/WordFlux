/**
 * Lambda Handler para WordFlux
 * 
 * Procesa texto recibido desde API Gateway y retorna estadísticas de palabras.
 * 
 * @module lambda
 */

const { countWords, getTopWords, formatResults } = require('./wordCounter');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Handler principal de Lambda
 * 
 * @param {Object} event - Evento de API Gateway
 * @param {Object} context - Contexto de Lambda
 * @returns {Promise<Object>} Respuesta para API Gateway
 */
exports.handler = async (event, context) => {
    // Configurar timeout del contexto
    context.callbackWaitsForEmptyEventLoop = false;

    // Directorio temporal para archivos creados dinámicamente
    const tmpDir = os.tmpdir();
    const createdFiles = [];

    try {
        // Parsear el body del request
        let body;
        if (typeof event.body === 'string') {
            body = JSON.parse(event.body);
        } else {
            body = event.body || {};
        }

        const filesToProcess = [];
        
        // 1. Manejar archivos pre-existentes (rutas)
        if (body.files && Array.isArray(body.files)) {
            // Validar que los archivos existan (asumiendo rutas relativas a la raíz de la lambda)
            // En Lambda, el código está en process.cwd() o especificado por LAMBDA_TASK_ROOT
            const baseDir = process.env.LAMBDA_TASK_ROOT || process.cwd();
            
            for (const filePath of body.files) {
                const absolutePath = path.resolve(baseDir, filePath);
                if (fs.existsSync(absolutePath)) {
                    filesToProcess.push(absolutePath);
                } else {
                    console.warn(`Archivo no encontrado: ${filePath}`);
                }
            }
        }

        // 2. Manejar contenido de texto crudo
        if (body.texts && Array.isArray(body.texts)) {
            for (let i = 0; i < body.texts.length; i++) {
                const textContent = body.texts[i];
                if (textContent && typeof textContent === 'string') {
                    const tempFilePath = path.join(tmpDir, `text-${Date.now()}-${i}.txt`);
                    fs.writeFileSync(tempFilePath, textContent, 'utf8');
                    filesToProcess.push(tempFilePath);
                    createdFiles.push(tempFilePath);
                }
            }
        }

        // 3. Fallback: Manejar un solo texto (compatibilidad hacia atrás)
        if (filesToProcess.length === 0 && (body.text || body.content)) {
            const text = body.text || body.content;
            const tempFilePath = path.join(tmpDir, `text-${Date.now()}-single.txt`);
            fs.writeFileSync(tempFilePath, text, 'utf8');
            filesToProcess.push(tempFilePath);
            createdFiles.push(tempFilePath);
        }

        // Validar que hay algo para procesar
        if (filesToProcess.length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'No se proporcionaron archivos válidos ni contenido de texto para procesar.',
                    example: {
                        files: ['data/archivo1.txt'],
                        texts: ['Texto 1...', 'Texto 2...']
                    }
                })
            };
        }

        console.log(`Procesando ${filesToProcess.length} archivos en paralelo...`);

        // Procesar archivos en paralelo usando worker threads
        // Nota: En Lambda, os.cpus() devuelve los vCPUs disponibles.
        // Ajustamos maxWorkers si es necesario, pero parallelProcessor ya maneja defaults.
        const { processFilesInParallel } = require('./parallelProcessor');
        
        const results = await processFilesInParallel(filesToProcess, {
            verbose: true // Para ver logs en CloudWatch
        });

        // Preparar respuesta
        const response = {
            success: true,
            summary: {
                totalFiles: filesToProcess.length,
                successful: results.successful.length,
                failed: results.failed.length,
                totalDuration: results.totalDuration, // parallelProcessor no devuelve esto directamente en el objeto root, lo calcularemos si falta o ajustaremos el processor
                totalWords: results.totalWords,
                uniqueWords: results.totalUniqueWords,
                linesProcessed: results.totalLinesProcessed
            },
            results: {
                successful: results.successful.map(r => ({
                    file: path.basename(r.filePath),
                    words: r.totalWords,
                    unique: r.uniqueWords,
                    duration: r.duration
                })),
                failed: results.failed.map(f => ({
                    file: path.basename(f.filePath),
                    error: f.error.message
                }))
            },
            // Top words combinadas
            topWords: require('./wordCounter').getTopWords(results.combinedWordMap, parseInt(body.topN || 10, 10))
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify(response, null, 2)
        };

    } catch (error) {
        console.error('Error en Lambda handler:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    } finally {
        // Limpieza de archivos temporales
        for (const file of createdFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            } catch (e) {
                console.warn(`No se pudo eliminar archivo temporal ${file}: ${e.message}`);
            }
        }
    }
};

/**
 * Handler para OPTIONS (CORS preflight)
 */
exports.optionsHandler = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Max-Age': '86400'
        },
        body: ''
    };
};

