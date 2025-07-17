import { createDataStreamResponse } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENROUTER_API_KEY,
  HUGGINGFACE_API_KEY
} = process.env;

export const runtime = "edge";

// 💾 DB client
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE! });

// 🧠 Embedding model
const embeddingModel = new HuggingFaceInferenceEmbeddings({
  apiKey: HUGGINGFACE_API_KEY!,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

export async function POST(req: Request) {
  let messages, latestMessage;
  let docContext = "";

  try {
    const json = await req.json();
    messages = json.messages;
    latestMessage = messages[messages.length - 1]?.content;

    // ✅ Real embeddings from Hugging Face
    const embedding = await embeddingModel.embedQuery(latestMessage);

    const collection = await db.collection(ASTRA_DB_COLLECTION!);
    const cursor = collection.find(null, {
      sort: { $vector: embedding },
      limit: 10,
    });

    const documents = await cursor.toArray();
    const docsMap = documents?.map((doc: any) => doc.text);

    docContext = docsMap
        .map(text => text.replace(/\s+/g, ' ').trim())
        .join("\n\n")
        .slice(0, 4000);

    console.log("🔍 Injected doc context:\n", docContext.slice(0, 500));  // preview
  } catch (err) {
    console.error("❌ Error querying DB:", err);
    docContext = "";
  }

  // 🧠 System prompt
  const template = {
    role: "system",
    content: `You are an AI assistant who knows everything about Formula One.
    Use the below context to answer user questions.
    If the context doesn't include what you need, rely on your own expertise.

    --------------
    START CONTEXT
    ${docContext}
    END CONTEXT

    --------------
    QUESTION: ${latestMessage}
    --------------`
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o", // ✅ Replace with a reliable model
      messages: [template, ...messages],
      stream: true,
      max_tokens: 1000
    })
  });

  return createDataStreamResponse({
    async execute(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        controller.write(`0:${chunk}` as any); // ⛳️ Compatible for streaming
      }
    },
    headers: { "Content-Type": "text/event-stream" }
  });
}
