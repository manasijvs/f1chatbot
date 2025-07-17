import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { ChatOpenAI } from "@langchain/openai";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";
dotenv.config();

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  HUGGINGFACE_API_KEY
} = process.env;

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const f1data = [
  'https://en.wikipedia.org/wiki/Formula_One',
  'https://www.skysports.com/f1',
  'https://www.formula1.com/en/latest',
  'https://www.forbes.com/sites/brettknight/2024/12/10/formula-1s-highest-paid-drivers-2024/',
  'https://www.forbes.com/profile/max-verstappen/',
  'https://www.forbes.com/profile/lewis-hamilton/',
  'https://www.formula1.com/en/teams',
  'https://en.wikipedia.org/wiki/2025_Formula_One_World_Championship',
];

// 💾 DB Connection
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE! });

// 🔨 Text Splitter
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

// 🧠 Chat Completion Model via OpenRouter
const model = new ChatOpenAI({
  apiKey: OPENROUTER_API_KEY!,
  model: "mistralai/mixtral-8x7b",
  configuration: {
    baseURL: OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  },
});

// 🧠 Embedding model via Hugging Face
const embeddingModel = new HuggingFaceInferenceEmbeddings({
  apiKey: HUGGINGFACE_API_KEY!,
  model: "sentence-transformers/all-MiniLM-L6-v2", // You can change to any other HF model
});

// 📂 Create Collection in Astra DB
const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
  const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
    vector: {
      dimension: 384, // 384 for MiniLM; change if using a different model
      metric: similarityMetric,
    },
  });
  console.log(res);
};

// 📄 Scrape content from a page
const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, '');
};

// 📦 Load and store embeddings into DB
const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION!);
  for await (const url of f1data) {
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);
    for await (const chunk of chunks) {
      const vector = await embeddingModel.embedQuery(chunk);
      const res = await collection.insertOne({
        $vector: vector,
        text: chunk,
      });
      console.log(res);
    }
  }
};

createCollection().then(() => loadSampleData());
