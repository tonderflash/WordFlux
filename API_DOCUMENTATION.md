# WordFlux API Documentation

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/count`

## Endpoint: `/count`

Processes text or files to count words and generate statistics. Supports parallel processing using worker threads.

### Method: `POST`

### Request Body Options

You can send either `files` (for files already on the server) or `texts` (for raw text input).

#### Option 1: Process Pre-loaded Files (The "Books" Example)
Use this option to process files that are included in the Lambda deployment package (e.g., in the `data/` folder).

```json
{
  "files": [
    "data/moby-dick.txt", 
    "data/dracula.txt", 
    "data/frankenstein.txt"
  ],
  "topN": 10
}
```

- **`files`**: Array of strings. Relative paths to files inside the Lambda environment.
- **`topN`**: (Optional) Number of top frequent words to return. Default is 10.

#### Option 2: Process Raw Text
Use this option to send text directly from the frontend (e.g., from a text area or file upload read by the browser).

```json
{
  "texts": [
    "First text block to process...",
    "Second text block to process..."
  ],
  "topN": 5
}
```

- **`texts`**: Array of strings. The actual content to process.

### Response Format

```json
{
  "success": true,
  "summary": {
    "totalFiles": 3,
    "successful": 3,
    "failed": 0,
    "totalDuration": "14.66",
    "totalWords": 468282,
    "uniqueWords": 22404,
    "linesProcessed": 45896
  },
  "results": {
    "successful": [
      {
        "file": "moby-dick.txt",
        "words": 222622,
        "unique": 17634,
        "duration": "6.46"
      }
      // ... other files
    ],
    "failed": []
  },
  "topWords": [
    { "word": "the", "count": 27203 },
    { "word": "and", "count": 15531 }
    // ... top N words
  ]
}
```

## Frontend Integration Example (JavaScript/Fetch)

Here is a helper function you can use in your frontend application:

```javascript
/**
 * Calls the WordFlux API to count words.
 * @param {string[]} inputs - Array of file paths OR array of text strings.
 * @param {boolean} isFilePaths - Set to true if inputs are file paths, false if raw text.
 * @param {number} topN - Number of top words to return.
 */
async function analyzeText(inputs, isFilePaths = false, topN = 10) {
  const API_URL = 'YOUR_API_GATEWAY_URL/count'; // Replace with your actual URL

  const payload = {
    topN: topN
  };

  if (isFilePaths) {
    payload.files = inputs;
  } else {
    payload.texts = inputs;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('Failed to analyze text:', error);
    throw error;
  }
}

// Usage Example 1: Processing Server Files
/*
analyzeText([
  "data/moby-dick.txt", 
  "data/dracula.txt"
], true, 10).then(data => console.log(data));
*/

// Usage Example 2: Processing User Input
/*
analyzeText([
  "User typed this text...",
  "And this one too..."
], false, 5).then(data => console.log(data));
*/
```
