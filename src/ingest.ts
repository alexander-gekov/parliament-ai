import { JSONLoader } from "langchain/document_loaders/fs/json";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const weaviateClient: WeaviateClient = weaviate.client({
    scheme: 'https',
    host: process.env.WEAVIATE_API_URL ?? "localhost",
    apiKey: new ApiKey(process.env.WEAVIATE_API_KEY ?? "default"),
  });

const files = fs.readdirSync("data_aug");
const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === '.json');

let allDocs = [];

for (const file of jsonFiles) {
    const loader = new JSONLoader(path.join("data_aug", file));
    const docs = await loader.load();
    allDocs = allDocs.concat(docs);
}

// Split the documents
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const splitDocs = await textSplitter.splitDocuments(allDocs);

const embeddings = new OpenAIEmbeddings();

// Create vector store from split documents
const vectorStore = new WeaviateStore(
    embeddings,
    {
        client: weaviateClient,
        indexName: "Sessions"
    }
  );

await vectorStore.addDocuments(splitDocs);