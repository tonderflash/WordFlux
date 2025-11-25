const { handler } = require('./src/lambda');
const path = require('path');
const fs = require('fs');

// Mock Context
const context = {
    callbackWaitsForEmptyEventLoop: true
};

async function runTests() {
    console.log('🧪 Iniciando pruebas locales de Lambda...\n');

    // Test 1: Procesamiento de textos crudos
    console.log('Test 1: Procesamiento de textos crudos');
    const event1 = {
        body: JSON.stringify({
            texts: [
                "Hola mundo esto es una prueba",
                "Hola mundo esto es otra prueba diferente"
            ],
            topN: 5
        })
    };

    try {
        const result1 = await handler(event1, context);
        console.log('Status Code:', result1.statusCode);
        const body1 = JSON.parse(result1.body);
        console.log('Success:', body1.success);
        console.log('Summary:', body1.summary);
        console.log('Top Words:', body1.topWords);
    } catch (error) {
        console.error('Test 1 Failed:', error);
    }

    console.log('\n--------------------------------------------------\n');

    // Test 2: Procesamiento de archivos (si existen en data/)
    const dataDir = path.join(__dirname, 'data');
    if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));
        if (files.length > 0) {
            console.log('Test 2: Procesamiento de archivos locales');
            const event2 = {
                body: JSON.stringify({
                    files: files.map(f => path.join('data', f)),
                    topN: 5
                })
            };

            try {
                const result2 = await handler(event2, context);
                console.log('Status Code:', result2.statusCode);
                const body2 = JSON.parse(result2.body);
                console.log('Success:', body2.success);
                console.log('Summary:', body2.summary);
                console.log('Top Words:', body2.topWords);
            } catch (error) {
                console.error('Test 2 Failed:', error);
            }
        } else {
            console.log('Test 2 Skipped: No .txt files in data/');
        }
    } else {
        console.log('Test 2 Skipped: data/ directory not found');
    }
}

runTests();
