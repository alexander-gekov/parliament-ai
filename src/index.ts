import { JSONLoader } from "langchain/document_loaders/fs/json";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";

dotenv.config();

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
  });

const loader = new JSONLoader("data/session.json");
const docs = await loader.load();

// Split the documents
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const splitDocs = await textSplitter.splitDocuments(docs);

console.log(splitDocs);

// Create vector store from split documents
const vectorStore = await MemoryVectorStore.fromDocuments(
    splitDocs,
    new OpenAIEmbeddings()
  );

const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 10
  });
const prompt = ChatPromptTemplate.fromTemplate(`
Вие сте полезен помощник, който може да отговори на въпроси за българския парламент спрямо познатите заседания и стенограми.
Контекст: {context}
Въпрос: {question}
Отговор: `);

const ragChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
});

const retrievedDocs = await retriever.invoke("С какво е свързана информацията?");

const response = await ragChain.invoke({
    question: "Кои са основните участници в разговора и какви теми обсъждат?",
    context: retrievedDocs,
});

console.log(response);