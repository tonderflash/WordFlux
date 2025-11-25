# 🚀 Guía de Deployment a AWS Lambda

Esta guía te explica cómo desplegar WordFlux en AWS Lambda y conectarlo con API Gateway.

## 📦 Opción 1: Subir ZIP Manualmente (Recomendado)

### Paso 1: Generar el ZIP

Ejecuta el script que crea el paquete ZIP automáticamente:

```bash
npm run build:lambda
```

O manualmente:

```bash
node build-lambda-zip.js
```

Esto creará el archivo `wordflux-lambda.zip` en la raíz del proyecto.

### Paso 2: Crear la Función Lambda en AWS

1. Ve a [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Click en **"Create function"**
3. Selecciona **"Author from scratch"**
4. Configura:
   - **Function name**: `wordflux-counter`
   - **Runtime**: `Node.js 24.x` (o `Node.js 20.x`, `Node.js 22.x`, `Node.js 18.x` según disponibilidad)
   - **Architecture**: `x86_64`
5. Click en **"Create function"**

### Paso 3: Subir el ZIP

1. En la página de la función, ve a la pestaña **"Code"**
2. Click en **"Upload from"** → **".zip file"**
3. Selecciona el archivo `wordflux-lambda.zip`
4. Click en **"Save"**

### Paso 4: Configurar el Handler

1. En la pestaña **"Code"**, ve a **"Runtime settings"**
2. Click en **"Edit"**
3. Configura:
   - **Handler**: `src/lambda.handler`
4. Click en **"Save"**

### Paso 5: Configurar Memoria y Timeout

1. Ve a la pestaña **"Configuration"** → **"General configuration"**
2. Click en **"Edit"**
3. Configura:
   - **Memory**: `512 MB` (o más si procesas textos muy grandes)
   - **Timeout**: `30 seconds` (o más según necesites)
4. Click en **"Save"**

### Paso 6: Crear API Gateway

1. En la pestaña **"Configuration"**, ve a **"Function URL"** o **"Triggers"**
2. Para API Gateway REST:
   - Click en **"Add trigger"**
   - Selecciona **"API Gateway"**
   - Selecciona **"Create an API"** → **"REST API"**
   - **Security**: `Open` (o configura CORS según necesites)
   - Click en **"Add"**
3. Para Function URL (más simple):
   - Ve a **"Configuration"** → **"Function URL"**
   - Click en **"Create function URL"**
   - **Auth type**: `NONE` (o `AWS_IAM` para más seguridad)
   - Click en **"Save"**
   - Copia la URL generada

### Paso 7: Probar el Endpoint

#### Con Function URL:

```bash
curl -X POST https://TU-FUNCTION-URL.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hola mundo, este es un texto de prueba para contar palabras.",
    "topN": 10
  }'
```

#### Con API Gateway:

```bash
curl -X POST https://TU-API-ID.execute-api.us-east-1.amazonaws.com/dev/count \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hola mundo, este es un texto de prueba para contar palabras.",
    "topN": 10
  }'
```

### Respuesta Esperada:

```json
{
  "success": true,
  "statistics": {
    "totalWords": 12,
    "uniqueWords": 10,
    "linesProcessed": 1
  },
  "topWords": [
    {
      "word": "hola",
      "count": 1
    },
    {
      "word": "mundo",
      "count": 1
    }
    // ... más palabras
  ]
}
```

## 📝 Estructura del ZIP

El ZIP contiene solo los archivos necesarios:

```
wordflux-lambda.zip
├── src/
│   ├── lambda.js          # Handler principal
│   └── wordCounter.js     # Lógica de conteo
└── package.json           # Metadata del proyecto
```

**Nota**: No se incluyen `worker.js` ni `parallelProcessor.js` porque Lambda no los necesita (procesa texto en memoria directamente).

## 🔧 Configuración Avanzada

### Variables de Entorno

Puedes agregar variables de entorno en Lambda:
- **Configuration** → **Environment variables**
- Ejemplo: `NODE_ENV=production`

### Límites de Lambda

- **Tamaño máximo del request**: 6 MB (API Gateway) o 10 MB (Function URL)
- **Tiempo máximo de ejecución**: 15 minutos
- **Memoria máxima**: 10 GB

Para textos muy grandes, considera:
- Usar S3 para almacenar el texto
- Procesar en chunks
- Usar Step Functions para orquestar

## 🧪 Testing Local

Puedes probar el handler localmente:

```javascript
// test-lambda.js
const { handler } = require('./src/lambda');

const event = {
  body: JSON.stringify({
    text: "Hola mundo, este es un texto de prueba.",
    topN: 5
  })
};

handler(event, {}, (error, result) => {
  if (error) console.error(error);
  else console.log(JSON.parse(result.body));
});
```

```bash
node test-lambda.js
```

## 📊 Monitoreo

- **CloudWatch Logs**: Los logs aparecen automáticamente en CloudWatch
- **Métricas**: Ve a la pestaña **"Monitoring"** en Lambda
- **Alarmas**: Configura alarmas para errores o latencia alta

## 🔒 Seguridad

- Usa **AWS_IAM** para Function URL si necesitas autenticación
- Configura **CORS** apropiadamente en API Gateway
- Considera usar **API Keys** o **Cognito** para API Gateway
- Limita el tamaño del request para evitar abusos

## 🐛 Troubleshooting

### Error: "Cannot find module"
- Verifica que el handler esté correcto: `src/lambda.handler`
- Asegúrate de que todos los archivos estén en el ZIP

### Error: "Timeout"
- Aumenta el timeout en la configuración
- Reduce el tamaño del texto o procesa en chunks

### Error: "Out of memory"
- Aumenta la memoria asignada
- Reduce el tamaño del texto procesado

### CORS Errors
- Verifica que los headers CORS estén en la respuesta
- Configura CORS en API Gateway si usas REST API

## 📚 Recursos

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

