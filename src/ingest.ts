import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";
import { Document } from "@langchain/core/documents";
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const weaviateClient: WeaviateClient = weaviate.client({
    scheme: 'https',
    host: process.env.WEAVIATE_API_URL ?? "localhost",
    apiKey: new ApiKey(process.env.WEAVIATE_API_KEY ?? "default"),
  });

const files = fs.readdirSync("output");
const textFiles = files.filter((file) => path.extname(file).toLowerCase() === '.txt');

let allDocs = [];

// Load documents with metadata
for (const file of textFiles) {
    const loader = new TextLoader(path.join("output", file));
    const docs = await loader.load();
    
    // Regex to match the speaker's name
    const speakerRegex = /\(ID:\s*(.*?)\)/;

    // Process each document to extract statements and metadata
    let currentSpeaker: string | null = null; // Initialize current speaker
    const docsWithMetadata = docs.flatMap(doc => {
        const statements = doc.pageContent.split('\n').filter(line => line.trim() !== '');
        return statements
            .map(statement => {
                // Check if the statement indicates a new speaker
                const speakerMatch = statement.match(speakerRegex);
                if (speakerMatch) {
                    currentSpeaker = speakerMatch[1].trim(); // Update current speaker
                    return null; // Return null for speaker identification lines
                }
                
                // Use the current speaker if available
                const speaker = currentSpeaker;
                const text = statement.trim();
                
                return new Document({
                    pageContent: text,
                    metadata: {
                        speaker: speaker,
                        file: file
                    }
                });
            })
            .filter(doc => doc !== null); // Remove null entries
    });
    
    allDocs.push(...docsWithMetadata);
}

// Split the documents
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", " ", ""],
  keepSeparator: true,
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

// Add documents with metadata
await vectorStore.addDocuments(splitDocs);