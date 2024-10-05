import { JSONLoader } from "langchain/document_loaders/fs/json";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { WeaviateStore } from "@langchain/weaviate";
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0
  });

const weaviateClient = (weaviate as any).client({
    scheme: "https",
    host: process.env.WEAVIATE_API_URL ?? "localhost",
    apiKey: new ApiKey(process.env.WEAVIATE_API_KEY ?? "default"),
});

console.log(weaviateClient);

// const loader = new JSONLoader("data/session.json");
const files = fs.readdirSync("data");
const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === '.json');

let allDocs = [];

for (const file of jsonFiles) {
    const loader = new JSONLoader(path.join("data", file));
    const docs = await loader.load();
    allDocs = allDocs.concat(docs);
}

console.log(allDocs.length);

// Split the documents
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const splitDocs = await textSplitter.splitDocuments(allDocs);

console.log(splitDocs.length);

// Create vector store from split documents
const vectorStore = await WeaviateStore.fromDocuments(
    splitDocs,
    new OpenAIEmbeddings(),
    {
        client: weaviateClient,
        indexName: "parliament-data",
        textKey: "text",
    }
  );

console.log(vectorStore);

const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 10
  });

const prompt = ChatPromptTemplate.fromTemplate(`Вие сте полезен асистент, специализиран в анализа на стенограми от заседания на българския парламент. Моля, прегледайте внимателно предоставения контекст и отговорете на следния въпрос, като се съсредоточите върху следните аспекти:

Контекст: {context}

Въпрос: {question}

При отговора си, моля обърнете специално внимание на следното:
1. Основната тема или теми на заседанието
2. Ключови решения, които са били взети
3. Имена на политици, които са взели думата, и кратко резюме на техните основни изказвания
4. Важни дебати или разногласия, ако има такива
5. Всякакви гласувания и техните резултати
6. Дата на заседанието, ако е посочена

Моля, структурирайте отговора си ясно и стегнато, като използвате подзаглавия за различните аспекти, ако е уместно. Ако някоя информация не е налична в предоставения контекст, просто посочете това.

Отговор:`);

const ragChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
});

const question = "Какви решения бяха взети през август месец?";

const retrievedDocs = await retriever.invoke(question);

console.log(retrievedDocs);

const response = await ragChain.invoke({
    question: question,
    context: retrievedDocs,
});

console.log(response);