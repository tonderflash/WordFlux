# WordFlux 📚

Procesador de archivos de texto grandes usando **streams** para eficiencia de memoria y **worker threads** para procesamiento paralelo.

## Características

- ✅ Procesa archivos de **cualquier tamaño** sin agotar la memoria
- ✅ Usa **streams** para lectura eficiente línea por línea
- ✅ **Worker threads** para procesar múltiples archivos en paralelo
- ✅ Cuenta palabras únicas y muestra **Top 10** más frecuentes
- ✅ Manejo robusto de errores
- ✅ Soporte para caracteres UTF-8 y acentos

## Requisitos

- Node.js >= 14.0.0

## Instalación

```bash
# Clonar o crear el proyecto
cd WordFlux

# No requiere dependencias externas!
# Node.js incluye todo lo necesario
```

## Uso Rápido

### 1. Descargar libro de prueba

```bash
# Descargar "Guerra y Paz" de Project Gutenberg (~3.3MB)
node scripts/downloadBook.js

# O descargar múltiples libros
node scripts/downloadBook.js --all

# Ver libros disponibles
node scripts/downloadBook.js --list
```

### 2. Procesar archivo

```bash
# Procesar un solo archivo
node src/index.js data/war-and-peace.txt

# Procesar múltiples archivos secuencialmente
node src/index.js data/war-and-peace.txt data/moby-dick.txt

# Procesar en paralelo con worker threads
node src/index.js data/*.txt --parallel

# Limitar número de workers
node src/index.js data/*.txt --parallel --workers=4
```

### 3. Ver ayuda

```bash
node src/index.js --help
```

## Ejemplo de Salida

```
═══════════════════════════════════════════════════════════════
📄 Archivo: war-and-peace.txt
───────────────────────────────────────────────────────────────
   Líneas procesadas: 66,055
   Total de palabras: 580,902
   Palabras únicas:   17,558
───────────────────────────────────────────────────────────────
🏆 TOP 10 PALABRAS MÁS FRECUENTES:
───────────────────────────────────────────────────────────────
    1. the                   34,495  ████████████████████
    2. and                   21,899  ████████████
    3. to                    16,700  █████████
    4. of                    14,998  ████████
    5. a                     10,481  ██████
    6. he                     9,585  █████
    7. his                    7,934  ████
    8. in                     7,739  ████
    9. that                   7,360  ████
   10. was                    7,290  ████
═══════════════════════════════════════════════════════════════
```

## Arquitectura

```
WordFlux/
├── src/
│   ├── index.js              # CLI y punto de entrada
│   ├── wordCounter.js        # Lógica de conteo con streams
│   ├── worker.js             # Worker thread individual
│   └── parallelProcessor.js  # Orquestador de workers
├── scripts/
│   └── downloadBook.js       # Descargador de libros
├── data/                     # Archivos de texto (ignorado por git)
├── bitacora.txt              # Diario de decisiones de diseño
└── package.json
```

## ¿Por qué Streams?

Cuando intentas leer un archivo de 4GB con `fs.readFile()`:

```javascript
// ❌ MAL - Carga TODO en memoria
const data = fs.readFileSync('archivo-4gb.txt');
// 💥 JavaScript heap out of memory
```

Con streams:

```javascript
// ✅ BIEN - Procesa en chunks pequeños (~64KB)
const stream = fs.createReadStream('archivo-4gb.txt');
const rl = readline.createInterface({ input: stream });

for await (const line of rl) {
    // Nunca más de una línea en memoria
    processLine(line);
}
```

## ¿Por qué Worker Threads?

Node.js es single-threaded. Si tienes 8 archivos y 8 núcleos de CPU:

- **Sin workers**: Procesa 1 archivo a la vez (usa 1 CPU)
- **Con workers**: Procesa 8 archivos en paralelo (usa 8 CPUs)

```
CPU 1: ████████████████ archivo1.txt
CPU 2: ████████████████ archivo2.txt
CPU 3: ████████████████ archivo3.txt
CPU 4: ████████████████ archivo4.txt
...
```

## Opciones CLI

| Opción | Descripción |
|--------|-------------|
| `--help, -h` | Muestra ayuda |
| `--parallel, -p` | Usa worker threads para paralelizar |
| `--workers=N` | Límite de workers simultáneos |
| `--quiet, -q` | Modo silencioso |

## Manejo de Errores

El programa continúa procesando aunque un archivo falle:

```
[2025-11-25 10:30:15] ✅ archivo1.txt procesado
[2025-11-25 10:30:16] ❌ archivo2.txt falló: ENOENT - no encontrado
[2025-11-25 10:30:18] ✅ archivo3.txt procesado

Resumen: 2 exitosos, 1 fallido
```

## Bitácora de Desarrollo

El archivo `bitacora.txt` contiene el razonamiento detallado detrás de cada decisión de diseño, incluyendo:

- Por qué `readline` vs stream raw
- Por qué `Map` vs Object
- Por qué Worker Threads vs Child Processes
- Estrategias de normalización de texto
- Manejo de errores

## Licencia

MIT

