curl.exe -X POST "https://api-inference.huggingface.co/embeddings/sentence-transformers/all-MiniLM-L6-v2" `
-H "Authorization: Bearer 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" `
-H "Content-Type: application/json" `
-d "{`"inputs`": `"Test sentence for embedding`"}"
